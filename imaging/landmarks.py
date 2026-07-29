"""Face geometry: 478 landmarks, and precise per-region masks built from them.

WHY THIS SERVICE EXISTS AT ALL. The Node pipeline this replaces had no idea
where the face was. Every crop window was a fraction of the WHOLE FRAME and the
skin-tone sampler read a hard-coded box in the middle of it — both correct only
if the face is centred and fills the picture. On a real arm's-length selfie
where the face is ~40% of frame, an "under-eye close-up" came back wider than
the whole head with sofa in it. Every effect was applied to the entire frame
because there was no spatial masking anywhere in the codebase.

Landmarks fix that at the root. Measured on the two hardest real photos we have:
478 points found on both, including a dark, rotated, reclining selfie where the
face is only 33% of frame width — the exact input that broke everything else.
The model is 3.6MB and runs on CPU in about a second.

REGION INDICES ARE DERIVED, NOT GUESSED. A first pass at this hardcoded index
lists from memory and put the "jaw" mask across a cheek. Everything below comes
from MediaPipe's own FaceLandmarksConnections topology, so it cannot drift from
the model that produced the points.
"""

from __future__ import annotations

import os
import urllib.request
from dataclasses import dataclass

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision.face_landmarker import FaceLandmarksConnections as FLC

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)
MODEL_PATH = os.environ.get(
    "FACE_LANDMARKER_MODEL",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_landmarker.task"),
)


def _ordered_ring(connections) -> list[int]:
    """Walk a MediaPipe connection set into a single ordered closed ring."""
    nxt = {e.start: e.end for e in connections}
    start = min(nxt)
    ring = [start]
    cur = nxt[start]
    while cur != start and len(ring) < len(nxt) + 1:
        ring.append(cur)
        cur = nxt.get(cur)
        if cur is None:
            break
    return ring


# The face silhouette, ordered: index 0 is the top of the forehead (point 10),
# and the ring runs down one side, across the chin (point 152) and up the other.
FACE_OVAL = _ordered_ring(FLC.FACE_LANDMARKS_FACE_OVAL)
CHIN = 152
_chin_at = FACE_OVAL.index(CHIN)

# THE JAW ARC — the lower half of the silhouette, ear to chin to ear. This is
# the line a "lift" has to move, and having it as an ordered path (rather than a
# blob) is what makes a controlled warp possible at all.
JAW_ARC = FACE_OVAL[_chin_at - 8 : _chin_at + 9]

LEFT_EYE = sorted({i for e in FLC.FACE_LANDMARKS_LEFT_EYE for i in (e.start, e.end)})
RIGHT_EYE = sorted({i for e in FLC.FACE_LANDMARKS_RIGHT_EYE for i in (e.start, e.end)})
LEFT_BROW = sorted({i for e in FLC.FACE_LANDMARKS_LEFT_EYEBROW for i in (e.start, e.end)})
RIGHT_BROW = sorted({i for e in FLC.FACE_LANDMARKS_RIGHT_EYEBROW for i in (e.start, e.end)})
LIPS = sorted({i for e in FLC.FACE_LANDMARKS_LIPS for i in (e.start, e.end)})
NOSE = sorted({i for e in FLC.FACE_LANDMARKS_NOSE for i in (e.start, e.end)})


@dataclass
class Face:
    """A detected face: landmark pixel coordinates plus the frame they sit in."""

    points: np.ndarray  # (478, 2) float32, pixel coords
    width: int
    height: int

    @property
    def bbox(self) -> tuple[int, int, int, int]:
        x0, y0 = self.points.min(axis=0)
        x1, y1 = self.points.max(axis=0)
        return int(x0), int(y0), int(x1 - x0), int(y1 - y0)

    @property
    def frame_fraction(self) -> float:
        """Face width as a fraction of the frame — the quality signal that the
        old pipeline had no way to measure, and the reason its crops missed."""
        # np.ptp(...) rather than arr.ptp() — the ndarray method was removed in
        # numpy 2.x, which is what Python 3.12 installs today.
        return float(np.ptp(self.points[:, 0]) / max(1, self.width))

    def interocular(self) -> float:
        """Distance between eye centres — the natural scale unit for a face.

        Every displacement in warp.py is expressed as a fraction of this, so a
        given strength means the same thing on a close-up and on a wide selfie.
        """
        li = self.points[LEFT_EYE].mean(axis=0)
        ri = self.points[RIGHT_EYE].mean(axis=0)
        return float(np.linalg.norm(li - ri))


_landmarker: vision.FaceLandmarker | None = None


def _ensure_model() -> str:
    if not os.path.exists(MODEL_PATH):
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    return MODEL_PATH


def detect(bgr: np.ndarray) -> Face | None:
    """The largest face in a BGR image, or None.

    None is a normal outcome (no face, too dark, too turned) and every caller
    must treat it as "we cannot help with this photo", never as a crash.
    """
    global _landmarker
    if _landmarker is None:
        _landmarker = vision.FaceLandmarker.create_from_options(
            vision.FaceLandmarkerOptions(
                base_options=mp_python.BaseOptions(model_asset_path=_ensure_model()),
                num_faces=1,
            )
        )
    h, w = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    res = _landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    if not res.face_landmarks:
        return None
    pts = np.array([[p.x * w, p.y * h] for p in res.face_landmarks[0]], np.float32)
    return Face(points=pts, width=w, height=h)


def _poly_mask(face: Face, poly: np.ndarray, feather: float) -> np.ndarray:
    """A soft 0..1 mask from a polygon, feathered by `feather` pixels.

    FEATHERING IS NOT COSMETIC HERE. Every operator in operators.py is a
    contrast change applied inside a region; a hard edge would print the shape
    of the mask onto the skin, which reads instantly as a fake. The old
    whole-frame effects had no edge to betray them and no way to be local
    either — this is the trade that buys locality back.
    """
    m = np.zeros((face.height, face.width), np.uint8)
    cv2.fillPoly(m, [poly.astype(np.int32)], 255)
    k = max(3, int(feather) | 1)
    m = cv2.GaussianBlur(m, (k, k), 0)
    return (m.astype(np.float32) / 255.0)


def region_masks(face: Face) -> dict[str, np.ndarray]:
    """Soft masks for the areas the report actually makes claims about.

    Keyed to match the analysis's own area names so a concern can be routed to
    a mask without a second opinion about what "under-eye" means.
    """
    p = face.points
    scale = face.interocular()
    feather = max(5.0, scale * 0.18)

    def below_eye(eye_idx: list[int]) -> np.ndarray:
        """The infraorbital region: the lower lid arc, swept down onto the cheek.

        Built by offsetting the lower lid rather than by naming fixed points,
        so it tracks the actual eye on this face at this angle.
        """
        eye = p[eye_idx]
        centre = eye.mean(axis=0)
        lower = eye[eye[:, 1] > centre[1]]
        if len(lower) < 3:
            lower = eye
        lower = lower[np.argsort(lower[:, 0])]
        drop = scale * 0.42
        skirt = lower[::-1] + np.array([0.0, drop], np.float32)
        return np.vstack([lower, skirt])

    masks: dict[str, np.ndarray] = {}
    masks["under-eye"] = np.clip(
        _poly_mask(face, below_eye(LEFT_EYE), feather)
        + _poly_mask(face, below_eye(RIGHT_EYE), feather),
        0,
        1,
    )

    # Forehead: between the brows and the top of the silhouette.
    brow = p[sorted(LEFT_BROW + RIGHT_BROW)]
    brow = brow[np.argsort(brow[:, 0])]
    top_arc = p[[i for i in FACE_OVAL[:11]]]
    masks["forehead"] = _poly_mask(
        face, np.vstack([brow, top_arc[::-1]]), feather
    )

    # Lower face: the jaw arc, lifted up into the cheeks so the region covers
    # the skin that sags rather than only the outline itself.
    jaw = p[JAW_ARC]
    inner = jaw + (p[NOSE].mean(axis=0) - jaw) * 0.45
    masks["jawline"] = _poly_mask(face, np.vstack([jaw, inner[::-1]]), feather)

    # Cheeks: the mid-face, excluding eyes, nose and mouth.
    hull = cv2.convexHull(p[FACE_OVAL].astype(np.int32))
    full = _poly_mask(face, hull.reshape(-1, 2).astype(np.float32), feather)
    holes = np.zeros_like(full)
    for idx, grow in ((LEFT_EYE, 1.7), (RIGHT_EYE, 1.7), (LIPS, 1.25), (NOSE, 1.15)):
        pts = p[idx]
        c = pts.mean(axis=0)
        holes += _poly_mask(
            face, cv2.convexHull(((pts - c) * grow + c).astype(np.int32)).reshape(-1, 2).astype(np.float32), feather
        )
    masks["face"] = full
    masks["cheeks"] = np.clip(full - np.clip(holes, 0, 1), 0, 1)
    return masks
