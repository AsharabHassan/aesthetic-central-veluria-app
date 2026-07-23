"use client";

import { useEffect, useRef, useState } from "react";

const OUT = 1024;

/**
 * Lets the client frame their face before the analysis runs.
 *
 * WHY THIS EXISTS. A photo taken sitting back from the camera is mostly torso,
 * sofa and wall — the face can be under a quarter of the frame, so the pipeline
 * works on a few hundred pixels of actual skin. The model then has almost
 * nothing to improve and the "after" comes back looking identical to the
 * "before". Framing, not the prompt, was why the preview looked untouched.
 *
 * Automatic detection was tried first and REJECTED. A vision model's bounding
 * boxes were routinely offset and oversized — on a seated portrait it returned a
 * box covering mostly wall with the face in one corner — and seeding the crop
 * from a bad box produces a confidently wrong default, which is worse than no
 * default at all. A person dragging a slider is exact by construction, needs no
 * model, no extra API call and no latency, and cannot regress.
 */
export default function FaceFramer({
  src,
  onConfirm,
  onRetake,
}: {
  src: string;
  onConfirm: (dataUrl: string) => void;
  onRetake: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  // A typical arm's-length selfie puts the face upper-centre. Starting zoomed IN
  // matters: someone who accepts the default still gets a usable face crop, and
  // the guide makes it obvious when it needs nudging.
  const [zoom, setZoom] = useState(1.7);
  // Centre of the crop, as a fraction of the image (0-1).
  const [cx, setCx] = useState(0.5);
  const [cy, setCy] = useState(0.4);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);

  /** Side of the source-image square we are cropping, in source pixels. */
  const cropSide = (i: HTMLImageElement, z: number) =>
    Math.min(i.width, i.height) / z;

  const clamp = (i: HTMLImageElement, z: number, x: number, y: number) => {
    const side = cropSide(i, z);
    const halfX = side / 2 / i.width;
    const halfY = side / 2 / i.height;
    return {
      x: Math.min(1 - halfX, Math.max(halfX, x)),
      y: Math.min(1 - halfY, Math.max(halfY, y)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !img || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const side = cropSide(img, zoom);
    // Screen pixels -> source pixels -> fraction of the image.
    const dx = ((e.clientX - drag.current.px) / rect.width) * side;
    const dy = ((e.clientY - drag.current.py) / rect.height) * side;
    drag.current = { px: e.clientX, py: e.clientY };
    const next = clamp(img, zoom, cx - dx / img.width, cy - dy / img.height);
    setCx(next.x);
    setCy(next.y);
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onZoom = (z: number) => {
    if (!img) return;
    setZoom(z);
    const next = clamp(img, z, cx, cy);
    setCx(next.x);
    setCy(next.y);
  };

  const confirm = () => {
    if (!img) return;
    const side = cropSide(img, zoom);
    const sx = cx * img.width - side / 2;
    const sy = cy * img.height - side / 2;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, side, side, 0, 0, OUT, OUT);
    onConfirm(canvas.toDataURL("image/jpeg", 0.92));
  };

  // Scale against the box's REAL on-screen size, not the 1024 output size — the
  // preview must show exactly the square that confirm() will produce, or people
  // frame one thing and get another.
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    setBoxW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const side = img ? cropSide(img, zoom) : 1;
  const scale = img && boxW ? boxW / side : 1;
  const style: React.CSSProperties = img
    ? {
        width: img.width * scale,
        height: img.height * scale,
        transform: `translate(${-(cx * img.width - side / 2) * scale}px, ${-(cy * img.height - side / 2) * scale}px)`,
        maxWidth: "none",
      }
    : {};

  return (
    <div className="mx-auto w-full max-w-sm text-center">
      <p className="display text-3xl text-plum">Frame your face</p>
      <p className="mx-auto mt-2 max-w-xs text-sm text-plum-soft">
        Drag and zoom so your face fills the circle. The closer we can see your
        skin, the more your results will show.
      </p>

      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative mx-auto mt-5 aspect-square w-full cursor-grab touch-none overflow-hidden rounded-3xl bg-plum/5 active:cursor-grabbing"
        style={{ containerType: "size" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && <img src={src} alt="" draggable={false} style={style} className="select-none" />}
        {/* Face guide. pointer-events-none so it never eats the drag. */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[76%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]" />
        </div>
      </div>

      <label className="mt-5 block text-left">
        <span className="text-xs font-medium uppercase tracking-wide text-plum-soft">
          Zoom
        </span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.02}
          value={zoom}
          onChange={(e) => onZoom(Number(e.target.value))}
          className="mt-2 w-full accent-plum"
          aria-label="Zoom"
        />
      </label>

      <div className="mt-5 flex flex-col gap-3">
        <button onClick={confirm} className="btn-serum w-full" disabled={!img}>
          Use this photo
        </button>
        <button onClick={onRetake} className="btn-ghost w-full">
          Choose another
        </button>
      </div>
    </div>
  );
}
