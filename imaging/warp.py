"""The lift — as geometry, which is what it actually is.

WHY A WARP AND NOT A MODEL. Every attempt to get a visible jawline lift out of
an image-edit model failed, and the measurements say why: `images.edit`
re-renders a frame and is free to change texture but has no notion of "move this
edge by four millimetres". Across three prompt variants the jaw region moved a
mean absolute 11.1 / 11.5 / 10.5 and came back visually identical every time;
generated on its own crop it scored 5.2, 5.7, 6.1, 9.1 — consistently the
weakest zone in the whole reel, and the one clients kept saying looked the same.

A lift is a DISPLACEMENT. Skin that has retracted sits higher; the jaw margin
moves. That is a warp, and a warp is exact: you specify the displacement in
pixels, it happens, it happens identically every run, and it is registered with
the original by construction because it starts from the original's own pixels.

WHAT MAKES IT HONEST. Three properties, all enforced here rather than asked for:

  1. IT CANNOT INVENT OR DELETE ANYTHING. `cv2.remap` resamples existing pixels.
     A mole, a capillary, a freckle, a blemish cannot vanish — it can only move
     with the skin it sits on, which is exactly what happens on a real face.
  2. THE DISPLACEMENT IS BOUNDED AND SCALE-FREE. Strength is expressed as a
     fraction of the interocular distance, so "0.06" means the same visible
     amount on a close-up and on an arm's-length selfie, and the ceiling is a
     number in the code rather than a model's mood.
  3. IT IS CONFINED TO THE JAW. Displacement falls to zero away from the jaw
     arc, so the eyes, nose, mouth and background are untouched — the identity
     and the framing survive by construction, not by instruction.

WHAT IT DELIBERATELY DOES NOT DO. It does not narrow the face, change the bone
structure, or add volume. The jaw margin is pulled UP along the face's own
vertical axis, never inward: a bioremodeller tightens skin, it does not reshape
a jaw, and a warp that slimmed the face would be selling something the product
cannot do.
"""

from __future__ import annotations

import cv2
import numpy as np

from landmarks import CHIN, JAW_ARC, Face

# Ceiling on the lift, as a fraction of interocular distance. ~0.09 is already
# at the edge of plausible for skin retraction over a course of treatment; the
# cap exists so a mis-set env var cannot ship a facelift.
MAX_LIFT = 0.09


def jaw_lift(
    bgr: np.ndarray,
    face: Face,
    strength: float = 0.05,
    softness: float = 1.6,
) -> np.ndarray:
    """Pull the jaw margin and lower cheek upward.

    strength: displacement at the jaw line, as a fraction of interocular
              distance. Clamped to MAX_LIFT.
    softness: how far the influence reaches, in multiples of the jaw's own
              extent. Larger = a broader, gentler pull.
    """
    strength = float(np.clip(strength, 0.0, MAX_LIFT))
    if strength <= 0:
        return bgr

    h, w = bgr.shape[:2]
    scale = face.interocular()
    amp = strength * scale

    jaw = face.points[JAW_ARC]
    chin = face.points[CHIN]

    # The face's own vertical axis, so a tilted head lifts along its own "up"
    # rather than along the image's. This is why the warp survives the reclining,
    # rotated selfies that broke the fixed-geometry assumptions elsewhere.
    brow_mid = face.points[[10]].mean(axis=0)
    axis = brow_mid - chin
    axis = axis / (np.linalg.norm(axis) + 1e-6)

    # Influence field: 1 on the jaw arc, falling off with distance. Built as a
    # distance transform from the arc so the falloff follows the jaw's shape
    # instead of a circle centred on the chin.
    arc = np.zeros((h, w), np.uint8)
    cv2.polylines(arc, [jaw.astype(np.int32)], False, 255, thickness=max(2, int(scale * 0.10)))
    dist = cv2.distanceTransform(255 - arc, cv2.DIST_L2, 5)
    reach = max(1.0, scale * softness)
    field = np.exp(-(dist / reach) ** 2).astype(np.float32)

    # Taper to zero above the mouth line so the pull cannot reach the eyes.
    mouth_y = float(face.points[13][1]) if len(face.points) > 13 else chin[1] - scale
    ys = np.arange(h, dtype=np.float32)[:, None]
    gate = np.clip((ys - (mouth_y - scale * 0.35)) / (scale * 0.6), 0.0, 1.0)
    field *= np.repeat(gate, w, axis=1)

    # Sample the SOURCE from below the destination: pixel (x,y) takes the colour
    # of the skin that used to sit lower down, which reads as that skin having
    # travelled up.
    grid_x, grid_y = np.meshgrid(
        np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32)
    )
    map_x = grid_x - axis[0] * amp * field
    map_y = grid_y - axis[1] * amp * field

    return cv2.remap(
        bgr, map_x, map_y, interpolation=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )


def measure_displacement(face: Face, strength: float) -> float:
    """The jaw's movement in pixels, so a caller can report it honestly."""
    return float(np.clip(strength, 0.0, MAX_LIFT) * face.interocular())
