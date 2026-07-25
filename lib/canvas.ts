/**
 * Shared browser-canvas primitives.
 *
 * These lived privately inside lib/download.ts, which was fine while the PDF
 * was the only thing that composited images. The results page now also crops a
 * hero region out of the before and after (components/HeroZoom.tsx) and blends
 * them into a course midpoint (components/CourseProgression.tsx), and all three
 * need identical geometry — a crop that framed the before differently from the
 * after would show the client a shift rather than an improvement.
 */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/** Draw an image cover-cropped (centered) into a destination rectangle. */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const scale = Math.max(dw / img.width, dh / img.height);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/**
 * Normalise any source image to a square canvas of `size`, centre-cropped.
 *
 * Every image in the pipeline is already square — FaceFramer emits 1024x1024
 * and gpt-image-2 is called at 1024x1024 — so in practice this is a resize.
 * It exists so the crop maths below cannot silently drift if that ever stops
 * being true: both images are forced through the same normalisation before a
 * region is taken from them, which is what keeps the two crops registered.
 */
export function toSquare(
  img: HTMLImageElement,
  size: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingQuality = "high";
    drawCover(ctx, img, 0, 0, size, size);
  }
  return canvas;
}

/**
 * Cut a square region out of a squared image, centred on (xPct, yPct) — the
 * coordinate space the skin analysis reports annotations in.
 *
 * `sidePct` is the region's side as a fraction of the image. The centre is
 * pulled inwards so the window always lies fully inside the frame: a concern
 * near the jaw or the hairline would otherwise crop off the edge and come back
 * padded with blank canvas.
 */
export function cropRegion(
  source: HTMLCanvasElement,
  xPct: number,
  yPct: number,
  sidePct: number,
  out: number,
): HTMLCanvasElement {
  const size = source.width;
  const side = Math.round(size * sidePct);
  const half = side / 2;
  const cx = Math.min(size - half, Math.max(half, (xPct / 100) * size));
  const cy = Math.min(size - half, Math.max(half, (yPct / 100) * size));

  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, cx - half, cy - half, side, side, 0, 0, out, out);
  }
  return canvas;
}
