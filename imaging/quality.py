"""Is this photo worth spending money on?

THE HOLE THIS CLOSES. Until now the only gate was one line inside the analysis
prompt telling Claude to reject unusable photos — buried under roughly seventy
lines instructing it to find 4-7 concerns no matter what, including a "you MUST
flag" on the jawline. It essentially never fired. A real test photo measured
mean luminance 60/255 (a workable one is ~164) and the app ran a full analysis
and five billed image generations on it, then showed the client a result nobody
could see.

Now the checks are numbers, they run before anything is billed, and the face
box makes the two that matter most possible at all: how much of the frame the
face occupies, and how bright the FACE is rather than the room.

DELIBERATELY SOFT. A false block costs a real lead, so `warn` is advisory and
the client can proceed anyway. Only genuinely hopeless photos are blocked.
"""

from __future__ import annotations

import cv2
import numpy as np

from landmarks import Face

# Tuned against the two real fixtures we have: a workable studio-style photo
# measures ~164 mean luma, and the reclining dark-room selfie that produced an
# unusable report measures ~24 whole-frame / ~60 on the region a phone would
# expose for. These are starting values, meant to be revisited once real client
# photos have been logged.
BLOCK_LUMA = 55
WARN_LUMA = 90
BLOCK_FACE_FRACTION = 0.18
WARN_FACE_FRACTION = 0.30
WARN_FOCUS = 45.0
BLOCK_FOCUS = 12.0


def _face_luma(bgr: np.ndarray, face: Face | None) -> float:
    """Mean luminance of the FACE, not the frame.

    The old code sampled a hard-coded box in the centre of the image and called
    it the face; on an off-centre subject that box was cushion and wall, and it
    drove a +/-25% global exposure correction. With a real face box this is
    simply the right measurement.
    """
    grey = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    if face is None:
        return float(grey.mean())
    x, y, w, h = face.bbox
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(grey.shape[1], x + w), min(grey.shape[0], y + h)
    if x1 <= x0 or y1 <= y0:
        return float(grey.mean())
    return float(grey[y0:y1, x0:x1].mean())


def _focus(bgr: np.ndarray, face: Face | None) -> float:
    """Variance of the Laplacian over the face — the standard blur proxy."""
    grey = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    if face is not None:
        x, y, w, h = face.bbox
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(grey.shape[1], x + w), min(grey.shape[0], y + h)
        if x1 > x0 and y1 > y0:
            grey = grey[y0:y1, x0:x1]
    if grey.size == 0:
        return 0.0
    grey = cv2.resize(grey, (256, 256))
    return float(cv2.Laplacian(grey, cv2.CV_64F).var())


def judge(bgr: np.ndarray, face: Face | None) -> dict:
    """A verdict plus the numbers behind it, so decisions are auditable."""
    luma = _face_luma(bgr, face)
    focus = _focus(bgr, face)
    frac = face.frame_fraction if face else 0.0
    h, w = bgr.shape[:2]

    issues: list[str] = []
    level = "pass"

    def flag(code: str, blocking: bool) -> None:
        nonlocal level
        issues.append(code)
        if blocking:
            level = "block"
        elif level == "pass":
            level = "warn"

    if face is None:
        flag("no_face", True)
    else:
        if frac < BLOCK_FACE_FRACTION:
            flag("face_too_small", True)
        elif frac < WARN_FACE_FRACTION:
            flag("face_small", False)

    if luma < BLOCK_LUMA:
        flag("too_dark", True)
    elif luma < WARN_LUMA:
        flag("dark", False)
    elif luma > 235:
        flag("overexposed", False)

    if focus < BLOCK_FOCUS:
        flag("very_blurry", True)
    elif focus < WARN_FOCUS:
        flag("soft_focus", False)

    if min(w, h) < 512:
        flag("low_resolution", False)

    return {
        "level": level,
        "issues": issues,
        "metrics": {
            "faceLuma": round(luma, 1),
            "focus": round(focus, 1),
            "faceFraction": round(frac, 4),
            "width": w,
            "height": h,
        },
        "message": _message(issues),
    }


def _message(issues: list[str]) -> str:
    """Client-facing, and specific — "try again" teaches nobody anything."""
    if "no_face" in issues:
        return "We couldn't find a face in this photo. Hold the phone at eye level and look straight into the camera."
    if "too_dark" in issues or "dark" in issues:
        return "This photo is quite dark. Face a window or a lamp so the light falls on your face — it makes a big difference to what we can show you."
    if "face_too_small" in issues or "face_small" in issues:
        return "Your face is quite small in the frame. Hold the phone a little closer so your face fills most of the picture."
    if "very_blurry" in issues or "soft_focus" in issues:
        return "This photo is a little soft. Hold still for a moment and tap your face on screen to focus."
    if "overexposed" in issues:
        return "This photo is very bright and some detail is lost. Try moving out of direct light."
    if "low_resolution" in issues:
        return "This photo is quite low resolution. A photo taken directly with your camera will show much more."
    return "Looks good."
