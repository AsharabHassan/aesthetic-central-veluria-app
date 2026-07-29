"""The imaging service.

Replaces the parts of the Node pipeline that were never going to work as
prompts: knowing where the face is, deciding whether a photo is usable, and
producing a controlled, repeatable, registered simulation.

Two endpoints, and the split matters:

  POST /geometry  — landmarks + quality verdict. CHEAP AND FIRST. Nothing is
                    billed until this says the photo is usable, which closes the
                    hole where a dark, off-centre selfie triggered five paid
                    image generations and produced nothing anyone could see.

  POST /simulate  — the deterministic simulation. No model, no GPU, no network,
                    no per-image cost, and identical output for identical input.
"""

from __future__ import annotations

import base64
import io
import os

import cv2
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field

from compose import compose
from landmarks import detect, region_masks
from quality import judge
from warp import jaw_lift, measure_displacement

app = FastAPI(title="Aesthetics Central imaging", version="0.1.0")


def _decode(data_url: str) -> np.ndarray | None:
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    try:
        buf = np.frombuffer(base64.b64decode(data_url), np.uint8)
        return cv2.imdecode(buf, cv2.IMREAD_COLOR)
    except Exception:
        return None


def _encode(bgr: np.ndarray, quality: int = 92) -> str:
    ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        return ""
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()


class ImageIn(BaseModel):
    image: str = Field(description="data: URL or bare base64")


class SimulateIn(ImageIn):
    """Strengths are fractions of interocular distance / 0-1 gains, so the same
    numbers mean the same thing on any photo at any framing."""

    lift: float = 0.05


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/geometry")
def geometry(body: ImageIn) -> dict:
    """Where the face is, and whether this photo is worth spending money on."""
    bgr = _decode(body.image)
    if bgr is None:
        return {"ok": False, "reason": "unreadable"}

    face = detect(bgr)
    verdict = judge(bgr, face)
    if face is None:
        return {"ok": False, "reason": "no_face", "quality": verdict}

    x, y, w, h = face.bbox
    return {
        "ok": True,
        "quality": verdict,
        "face": {
            "x": x,
            "y": y,
            "width": w,
            "height": h,
            "frameFraction": round(face.frame_fraction, 4),
            "interocular": round(face.interocular(), 1),
        },
        # Percentages, matching the coordinate space the report already uses for
        # annotations — so the Node side can crop a zone against real anatomy
        # instead of against a fraction of the whole frame.
        "regions": {
            name: _region_centre(mask)
            for name, mask in region_masks(face).items()
        },
    }


def _region_centre(mask: np.ndarray) -> dict:
    ys, xs = np.nonzero(mask > 0.5)
    if len(xs) == 0:
        return {"present": False}
    h, w = mask.shape
    return {
        "present": True,
        "x": round(100.0 * float(xs.mean()) / w, 2),
        "y": round(100.0 * float(ys.mean()) / h, 2),
        "left": round(100.0 * float(xs.min()) / w, 2),
        "top": round(100.0 * float(ys.min()) / h, 2),
        "right": round(100.0 * float(xs.max()) / w, 2),
        "bottom": round(100.0 * float(ys.max()) / h, 2),
    }


class PatchIn(BaseModel):
    """One generated close-up and the square it came from."""

    left: int
    top: int
    side: int
    image: str


class ComposeIn(BaseModel):
    image: str
    patches: list[PatchIn]
    """0-1. Below 1 the composited change is dialled back toward the original."""
    strength: float = 1.0
    """Optional geometric lift, applied under the patches."""
    lift: float = 0.0


@app.post("/compose")
def compose_endpoint(body: ComposeIn) -> dict:
    """Build the full-face "after" from the close-ups that actually worked.

    The close-ups are the real result — each is generated on its own 1024px
    crop, which is the only scale at which this model changes anything. This
    puts them back where they came from, masked to the face so nothing outside
    the skin is ever sourced from a generated image. The base is the client's
    own photograph, so the result overlays it exactly.
    """
    bgr = _decode(body.image)
    if bgr is None:
        return {"ok": False, "reason": "unreadable"}
    face = detect(bgr)
    if face is None:
        return {"ok": False, "reason": "no_face"}

    decoded = []
    for p in body.patches:
        img = _decode(p.image)
        if img is None:
            continue
        decoded.append({"left": p.left, "top": p.top, "side": p.side, "image": img})
    if not decoded:
        return {"ok": False, "reason": "no_patches"}

    base = jaw_lift(bgr, face, strength=body.lift) if body.lift > 0 else bgr
    out = compose(base, face, decoded, strength=body.strength)

    return {
        "ok": True,
        "image": _encode(out),
        "applied": {"patches": len(decoded), "strength": body.strength},
    }


@app.post("/simulate")
def simulate(body: SimulateIn) -> dict:
    """The deterministic simulation.

    Everything here is a resample or a bounded contrast change inside a mask, so
    it cannot invent or delete a feature: a mole, a capillary, a freckle or an
    active blemish survives by construction rather than by being asked to.
    """
    bgr = _decode(body.image)
    if bgr is None:
        return {"ok": False, "reason": "unreadable"}
    face = detect(bgr)
    if face is None:
        return {"ok": False, "reason": "no_face"}

    out = jaw_lift(bgr, face, strength=body.lift)

    return {
        "ok": True,
        "image": _encode(out),
        # Reported so the caller can be honest about what was actually done —
        # and so a claim can be checked against a number rather than a promise.
        "applied": {
            "liftStrength": round(float(min(body.lift, 0.09)), 4),
            "liftPixels": round(measure_displacement(face, body.lift), 1),
        },
    }
