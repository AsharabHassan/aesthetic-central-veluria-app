import sharp from "sharp";

/**
 * Put the generated close-ups back onto the whole face.
 *
 * WHY ASSEMBLED RATHER THAN GENERATED. A single full-face generation does not
 * change anything: `images.edit` re-renders the frame, so at that scale any one
 * area is a few hundred pixels and comes back retextured. Measured, the jaw
 * moved a mean absolute ~11 across three prompt variants and looked identical
 * every time. The SAME areas generated on their own 1024px crops score 16-23
 * and are unmistakable. So the close-ups are the result; this puts them back.
 *
 * WHY IT IS HERE AND NOT IN PYTHON, which is a reversal worth recording. This
 * was a FastAPI service using MediaPipe landmarks to mask each patch to the
 * convex hull of the face oval. That mask is better than what is below. It was
 * still the wrong trade: nothing started the service, so `/api/compose` returned
 * 503, `previewImage` stayed null, and `AnalysisReport` rendered the slider
 * branch as `null` — the owner opened the page and saw no before/after at all.
 * A more accurate mask that is never reached loses to a good-enough mask that
 * always runs. One process, `next dev` starts it, and this failure mode is gone.
 *
 * WHAT REPLACES THE LANDMARKS. The seam the hull was protecting against is real:
 * the model repaints whatever background, hair and clothing fall inside its
 * crop, so a hard rectangular paste puts an invented grey wall against the
 * client's black top along a straight line. Two things stand in for it here —
 * a feathered ellipse over the face region, and a feathered border on each
 * patch — and the mask is the INTERSECTION of the two, exactly as the hull
 * version intersected "inside the face" with "away from the crop border".
 * Per-channel tone matching is kept, because the hull version's own notes are
 * clear that it was not sufficient alone but was still doing work.
 */

/** The square everything is normalised to — the browser and /api/zone agree on it. */
export const CANVAS = 1024;

export interface Patch {
  /** Where the crop was cut from, in CANVAS coordinate space. */
  left: number;
  top: number;
  side: number;
  /** The generated close-up, at any resolution. */
  image: Buffer;
}

interface Box {
  left: number;
  top: number;
  side: number;
}

/**
 * A soft 0..255 mask covering the face and nothing else.
 *
 * Starts from where a framed selfie's face actually sits in a `fit: "cover"`
 * square — `components/FaceFramer.tsx` is what makes that a safe assumption —
 * then GROWS to contain every zone box, so a jawline or forehead crop near the
 * edge is never clipped by a mask that was guessing.
 *
 * Deliberately short of the silhouette. The jaw against the neck and the
 * hairline are exactly where a paste betrays itself, and keeping the blend
 * inside both means the composite never has to reconcile two renderings of a
 * boundary.
 */
export async function faceMask(boxes: Box[], size = CANVAS): Promise<Buffer> {
  let cx = size / 2;
  let cy = size * 0.47;
  let rx = size * 0.36;
  let ry = size * 0.46;

  if (boxes.length > 0) {
    const left = Math.min(...boxes.map((b) => b.left));
    const top = Math.min(...boxes.map((b) => b.top));
    const right = Math.max(...boxes.map((b) => b.left + b.side));
    const bottom = Math.max(...boxes.map((b) => b.top + b.side));
    // Grow, never shrink: one under-eye zone must not collapse the face region
    // down to the under-eye.
    rx = Math.max(rx, (right - left) / 2, Math.abs(cx - left), Math.abs(right - cx));
    ry = Math.max(ry, (bottom - top) / 2, Math.abs(cy - top), Math.abs(bottom - cy));
  }

  rx = Math.min(rx, size * 0.5);
  ry = Math.min(ry, size * 0.5);

  const svg = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="black"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="white"/></svg>`,
  );

  return sharp(svg)
    .blur(Math.max(2, size * 0.03))
    .greyscale()
    .toColourspace("b-w")
    .png()
    .toBuffer();
}

/**
 * A patch-sized mask that fades out at the crop border.
 *
 * The Python original ramped linearly over 12% of the crop. A blur of an inset
 * rectangle is the same idea with a smoother falloff, which blends better and
 * is one operation instead of four slice-assignments.
 */
async function edgeMask(side: number): Promise<Buffer> {
  const pad = Math.max(2, Math.round(side * 0.12));
  const inner = Math.max(1, side - pad * 2);
  const svg = Buffer.from(
    `<svg width="${side}" height="${side}"><rect width="${side}" height="${side}" fill="black"/>` +
      `<rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" fill="white"/></svg>`,
  );
  return sharp(svg)
    .blur(Math.max(1, pad / 2))
    .greyscale()
    .toColourspace("b-w")
    .png()
    .toBuffer();
}

/**
 * DECODE TO RAW AND BLEND BY HAND, rather than leaning on sharp's compositing.
 *
 * Two of sharp's masking routes were tried first and BOTH failed silently,
 * which is why this does the arithmetic itself:
 *
 *  - `composite({ blend: "dest-in" })` masks by the source's ALPHA. A greyscale
 *    PNG is opaque everywhere — its grey levels are in the colour channels — so
 *    the call was a no-op and every patch stayed a hard-edged square.
 *  - `joinChannel(mask, { raw: … })` was meant to attach the mask AS alpha.
 *    Measured, it returned a 3-channel image with `hasAlpha: false` and the
 *    mask bytes interleaved into the colour data, which composited as vertical
 *    stripes. Also silent.
 *
 * A hand-written `base*(1-m) + patch*m` over raw buffers is what the landmark
 * implementation this replaced always did, it is a few lines, and it cannot
 * fail quietly — the buffer lengths are asserted, so a channel-count surprise
 * throws instead of producing a plausible-looking wrong picture.
 */

/** Decoded 3-channel RGB, alpha flattened away, at an exact size. */
async function rawRGB(buf: Buffer, width: number, height: number): Promise<Buffer> {
  const out = await sharp(buf)
    .resize(width, height, { fit: "fill" })
    .flatten({ background: "#000000" })
    .removeAlpha()
    .raw()
    .toBuffer();
  if (out.length !== width * height * 3) {
    throw new Error(`expected 3-channel raw, got ${out.length / (width * height)}`);
  }
  return out;
}

/** Decoded single-channel mask, 0..255, at an exact size. */
async function rawMask(buf: Buffer, width: number, height: number): Promise<Buffer> {
  const out = await sharp(buf)
    .resize(width, height, { fit: "fill" })
    // flatten BEFORE greyscale: sharp rasterises SVG with an alpha channel, so
    // the mask is really grey+alpha and `.raw()` would hand back two
    // interleaved channels for a buffer we are about to index as one.
    .flatten({ background: "#000000" })
    .greyscale()
    .toColourspace("b-w")
    .removeAlpha()
    .raw()
    .toBuffer();
  if (out.length !== width * height) {
    throw new Error(`expected 1-channel mask, got ${out.length / (width * height)}`);
  }
  return out;
}

/** `dst = dst*(1-m) + src*m`, in place, over a sub-rectangle of dst. */
function blendInto(
  dst: Buffer,
  dstWidth: number,
  src: Buffer,
  mask: Buffer,
  x0: number,
  y0: number,
  width: number,
  height: number,
): void {
  for (let y = 0; y < height; y++) {
    const drow = ((y0 + y) * dstWidth + x0) * 3;
    const srow = y * width * 3;
    const mrow = y * width;
    for (let x = 0; x < width; x++) {
      const m = mask[mrow + x] / 255;
      if (m <= 0) continue;
      const di = drow + x * 3;
      const si = srow + x * 3;
      dst[di] = Math.round(dst[di] * (1 - m) + src[si] * m);
      dst[di + 1] = Math.round(dst[di + 1] * (1 - m) + src[si + 1] * m);
      dst[di + 2] = Math.round(dst[di + 2] * (1 - m) + src[si + 2] * m);
    }
  }
}

/**
 * Bring the patch into the base's exposure and colour balance.
 *
 * Measured over the CENTRE of the patch, not the whole rectangle. The original
 * measured over the blended region only, for the reason that a jawline crop is
 * largely neck and background and matching against that drags facial skin
 * toward things we are not going to paste. The centre is the part of the crop
 * that is inside both masks at full weight, so it is the same population.
 *
 * The gain is clamped exactly as before: this corrects exposure drift, it does
 * not get to restyle the patch.
 */
async function toneMatch(
  patch: Buffer,
  base: Buffer,
  side: number,
): Promise<Buffer> {
  const inset = Math.round(side * 0.2);
  const w = Math.max(1, side - inset * 2);
  const centre = (b: Buffer) =>
    sharp(b)
      .extract({ left: inset, top: inset, width: w, height: w })
      .removeAlpha()
      .png()
      .toBuffer();

  // Materialised BEFORE stats(): sharp's .stats() measures its INPUT and
  // silently ignores a pipeline in front of it. That bug has shipped in this
  // repo before — see faceLuminance in lib/glow.ts.
  const [pc, bc] = await Promise.all([centre(patch), centre(base)]);
  const [ps, bs] = await Promise.all([sharp(pc).stats(), sharp(bc).stats()]);

  const gains = [0, 1, 2].map((ch) => {
    const pm = ps.channels[ch]?.mean ?? 0;
    const bm = bs.channels[ch]?.mean ?? 0;
    if (pm <= 1e-3) return 1;
    return Math.min(1.33, Math.max(0.75, bm / pm));
  });

  if (gains.every((g) => Math.abs(g - 1) < 0.01)) return patch;
  return sharp(patch).linear(gains, [0, 0, 0]).png().toBuffer();
}

/**
 * Composite generated zone crops onto the original photograph.
 *
 * Patches are applied in order, each through the intersection of the face mask
 * and its own edge mask, so overlapping zones accumulate rather than fight.
 * Every pixel outside the face mask is the client's own photograph, untouched.
 */
export async function composePatches(
  original: Buffer,
  patches: Patch[],
  strength = 1,
  size = CANVAS,
): Promise<{ image: Buffer; applied: number }> {
  // The whole composite is done on ONE raw buffer, mutated in place, instead of
  // re-encoding a PNG per patch. Three zones used to mean three decode/encode
  // round-trips of a 1024² image for no reason.
  const out = await rawRGB(
    await sharp(original).resize(size, size, { fit: "cover" }).png().toBuffer(),
    size,
    size,
  );

  const face = await faceMask(patches, size);
  const s = Math.min(1, Math.max(0, strength));
  let applied = 0;

  for (const p of patches) {
    const side = Math.round(p.side);
    if (side <= 0) continue;

    // Clip the box to the frame — a zone near the hairline or jaw can be
    // specified partly outside it.
    const x0 = Math.max(0, Math.round(p.left));
    const y0 = Math.max(0, Math.round(p.top));
    const x1 = Math.min(size, Math.round(p.left) + side);
    const y1 = Math.min(size, Math.round(p.top) + side);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) continue;

    const resized = await sharp(p.image)
      .resize(side, side, { fit: "fill" })
      .removeAlpha()
      .png()
      .toBuffer();

    // The part of the resized patch that actually lands in frame.
    const px0 = x0 - Math.round(p.left);
    const py0 = y0 - Math.round(p.top);

    const [visible, edge, faceRegion] = await Promise.all([
      sharp(resized).extract({ left: px0, top: py0, width: w, height: h }).png().toBuffer(),
      edgeMask(side).then((m) =>
        sharp(m).extract({ left: px0, top: py0, width: w, height: h }).png().toBuffer(),
      ),
      sharp(face).extract({ left: x0, top: y0, width: w, height: h }).png().toBuffer(),
    ]);

    // The base under this patch, cut straight from the raw buffer so it
    // reflects any earlier patch that already landed here.
    const region = Buffer.allocUnsafe(w * h * 3);
    for (let y = 0; y < h; y++) {
      out.copy(region, y * w * 3, ((y0 + y) * size + x0) * 3, ((y0 + y) * size + x0 + w) * 3);
    }
    const regionPng = await sharp(region, { raw: { width: w, height: h, channels: 3 } })
      .png()
      .toBuffer();

    // The mask is the INTERSECTION of "inside the face" and "away from the crop
    // border", scaled by strength — multiplied as numbers, not as a blend mode.
    const [edgeRaw, faceRaw] = await Promise.all([
      rawMask(edge, w, h),
      rawMask(faceRegion, w, h),
    ]);
    const mask = Buffer.allocUnsafe(w * h);
    let peak = 0;
    for (let i = 0; i < mask.length; i++) {
      const v = Math.round((edgeRaw[i] / 255) * (faceRaw[i] / 255) * s * 255);
      mask[i] = v;
      if (v > peak) peak = v;
    }
    if (peak <= 2) continue;

    const matched = await toneMatch(visible, regionPng, Math.min(w, h));
    blendInto(out, size, await rawRGB(matched, w, h), mask, x0, y0, w, h);
    applied += 1;
  }

  const image = await sharp(out, { raw: { width: size, height: size, channels: 3 } })
    .png()
    .toBuffer();
  return { image, applied };
}

/**
 * Blend a graded version of the whole frame back in, but only inside the face.
 *
 * WHY THIS EXISTS AT ALL. Before this, the full-face "after" was NOTHING BUT the
 * patches — so when `/api/zone` dropped zones under its change floor (and it is
 * a lottery: the same crop measured 21.7, 17.6 and 10.5 on identical input), the
 * composite came back pixel-identical to the client's own photograph and the
 * slider had nothing to show. That is the "there's no difference" the owner
 * reported. A guaranteed, dialable floor belongs here for the same reason
 * lib/glow.ts exists at all.
 *
 * CONFINED TO THE FACE, deliberately. lib/glow.ts is explicit from its own
 * measurements that these whole-frame passes are only correct on a face region —
 * run across a full frame they grade hair, clothing and background too, which
 * is what a beauty filter looks like.
 */
export async function gradeWithinFace(
  composed: Buffer,
  graded: Buffer,
  boxes: Box[],
  size = CANVAS,
): Promise<Buffer> {
  const [base, top, mask] = await Promise.all([
    rawRGB(composed, size, size),
    rawRGB(graded, size, size),
    faceMask(boxes, size).then((m) => rawMask(m, size, size)),
  ]);

  blendInto(base, size, top, mask, 0, 0, size, size);

  return sharp(base, { raw: { width: size, height: size, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

/**
 * Mean absolute difference between two images, on a normalised greyscale square.
 *
 * The same measure `/api/zone` gates individual close-ups with, so the two
 * numbers are on the same scale and can be reasoned about together.
 */
export async function changeScore(after: Buffer, before: Buffer): Promise<number> {
  const norm = (b: Buffer) =>
    sharp(b).resize(512, 512, { fit: "fill" }).greyscale().png().toBuffer();
  const [a, b] = await Promise.all([norm(after), norm(before)]);
  const diff = await sharp(a)
    .composite([{ input: b, blend: "difference" }])
    .png()
    .toBuffer();
  return (await sharp(diff).stats()).channels[0].mean;
}
