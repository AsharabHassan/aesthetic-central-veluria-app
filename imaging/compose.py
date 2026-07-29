"""Put the generated close-ups back onto the whole face.

WHY THIS IS THE RIGHT SHAPE. Generating a full face in one pass does not work:
`images.edit` re-renders the frame, so at full-face scale any one area is a few
hundred pixels and comes back retextured rather than changed — measured, the jaw
moved a mean absolute ~11 across three prompt variants and looked identical
every time. Generating each area on its OWN 1024px crop does work: the same
regions score 16-23 and are unmistakable. So the close-ups are the real result,
and the full-face "after" should be assembled from them rather than attempted
separately.

A FIRST ATTEMPT AT THIS FAILED, AND THE REASON IS WHY THIS FILE EXISTS. Pasting
a generated crop back with a rectangular feathered mask left a visible box: the
model repaints whatever background, hair and clothing fall inside its crop, so
the patch's invented grey wall met the original's black top along a straight
line. Per-channel tone matching did not save it, because the mismatch was
content, not exposure.

Landmarks fix it properly. Every patch is masked to the FACE ITSELF — the
convex hull of the face oval, eroded slightly and feathered — so the composite
can only ever touch skin. Background, hair, clothing and the silhouette are
never sourced from the generated image at all, which means the seam has nowhere
to appear. It also means the result overlays the original exactly: every pixel
outside the face is the client's own photograph, untouched.
"""

from __future__ import annotations

import cv2
import numpy as np

from landmarks import FACE_OVAL, Face


def face_skin_mask(face: Face, feather_scale: float = 0.22) -> np.ndarray:
    """A soft 0..1 mask covering the skin of the face and nothing else.

    Eroded off the silhouette before feathering, so the blend finishes well
    inside the face outline. The edge of the jaw against the neck, and the
    hairline, are exactly where a paste betrays itself — keeping the mask short
    of both means the composite never has to reconcile two different renderings
    of a boundary.
    """
    hull = cv2.convexHull(face.points[FACE_OVAL].astype(np.int32))
    m = np.zeros((face.height, face.width), np.uint8)
    cv2.fillConvexPoly(m, hull, 255)

    scale = face.interocular()
    erode = max(3, int(scale * 0.10))
    m = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (erode, erode)))
    k = max(3, int(scale * feather_scale) | 1)
    m = cv2.GaussianBlur(m, (k, k), 0)
    return m.astype(np.float32) / 255.0


def _tone_match(patch: np.ndarray, base: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Bring the patch into the base's exposure and colour balance.

    Measured over the BLENDED REGION ONLY, not the whole rectangle: a jawline
    crop is largely neck and background, and matching against that would drag
    the facial skin to the average of things we are not going to paste.
    """
    w = mask > 0.15
    if w.sum() < 64:
        return patch
    out = patch.astype(np.float32)
    for ch in range(3):
        bm = float(base[:, :, ch][w].mean())
        pm = float(out[:, :, ch][w].mean())
        if pm <= 1e-3:
            continue
        gain = float(np.clip(bm / pm, 0.75, 1.33))
        out[:, :, ch] *= gain
    return np.clip(out, 0, 255).astype(np.uint8)


def compose(
    original: np.ndarray,
    face: Face,
    patches: list[dict],
    strength: float = 1.0,
) -> np.ndarray:
    """Composite generated zone crops onto the original photograph.

    `patches` is a list of {"left", "top", "side", "image"} where image is a
    BGR array of the generated crop at any resolution, and left/top/side
    describe the square it was cut from in `original`'s coordinate space.

    Patches are applied in the order given, each through the face mask, so
    overlapping zones accumulate rather than fight.
    """
    h, w = original.shape[:2]
    skin = face_skin_mask(face)
    out = original.astype(np.float32)

    for p in patches:
        left, top, side = int(p["left"]), int(p["top"]), int(p["side"])
        img = p["image"]
        if side <= 0 or img is None:
            continue

        # Clip the box to the frame — a zone near the hairline or jaw can be
        # specified partly outside it.
        x0, y0 = max(0, left), max(0, top)
        x1, y1 = min(w, left + side), min(h, top + side)
        if x1 <= x0 or y1 <= y0:
            continue

        resized = cv2.resize(img, (side, side), interpolation=cv2.INTER_CUBIC)
        # Take the part of the resized patch that actually lands in frame.
        px0, py0 = x0 - left, y0 - top
        patch = resized[py0 : py0 + (y1 - y0), px0 : px0 + (x1 - x0)]

        region_skin = skin[y0:y1, x0:x1]
        base_region = out[y0:y1, x0:x1]

        # Soften the patch's own rectangular edge as well, so the mask is the
        # INTERSECTION of "inside the face" and "away from the crop border".
        bh, bw = patch.shape[:2]
        edge = np.ones((bh, bw), np.float32)
        pad = max(2, int(min(bh, bw) * 0.12))
        ramp = np.linspace(0.0, 1.0, pad, dtype=np.float32)
        edge[:pad, :] *= ramp[:, None]
        edge[-pad:, :] *= ramp[::-1][:, None]
        edge[:, :pad] *= ramp[None, :]
        edge[:, -pad:] *= ramp[::-1][None, :]

        m = np.clip(region_skin * edge * float(np.clip(strength, 0.0, 1.0)), 0.0, 1.0)
        if m.max() <= 0.01:
            continue

        matched = _tone_match(patch, base_region.astype(np.uint8), m).astype(np.float32)
        m3 = m[:, :, None]
        out[y0:y1, x0:x1] = base_region * (1.0 - m3) + matched * m3

    return np.clip(out, 0, 255).astype(np.uint8)
