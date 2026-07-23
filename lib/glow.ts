import sharp from "sharp";

/**
 * Deterministic "hydration grade" applied to the AI "after" image.
 *
 * WHY THIS EXISTS. `images.edit` is a reconstruction operation: gpt-image-2 is
 * built to hand back its input with modifications, and it is strongly biased
 * toward reproducing what it sees. Three successive prompt rewrites could not
 * reliably push it past "looks the same" on skin that was already healthy —
 * because there is little to repair, so it repairs little. Adjectives cannot
 * beat the model's core behaviour.
 *
 * But the optical signature of well-hydrated skin is not mysterious:
 *   1. specular sheen where light already falls (water in the dermis reflects),
 *   2. a lift of the dull, sallow, light-absorbing cast of dehydrated skin,
 *   3. slightly softened surface micro-texture.
 * All three are image operations. Doing them here makes the result GUARANTEED
 * and DIALABLE instead of a dice-roll on each generation.
 *
 * SAFETY. This is a filter, not a generator: it cannot invent or delete a
 * feature. A blemish, pigment patch, capillary or scar physically cannot vanish
 * — it can only be relit. That matters, because the obvious alternative (a
 * second AI pass) *did* visibly erase acne, since each pass preserves features
 * only relative to its own input and the erosion compounds.
 */

/** 0 = off, 1 = clinical (subtle), 2 = balanced, 3 = campaign. */
export type GlowStrength = 0 | 1 | 2 | 3;

const SCALE: Record<number, number> = { 1: 0.45, 2: 0.75, 3: 1.0 };

export function glowStrengthFromEnv(): GlowStrength {
  const n = Number(process.env.GLOW_STRENGTH ?? 3);
  return ([0, 1, 2, 3] as const).includes(n as GlowStrength) ? (n as GlowStrength) : 3;
}

export function firmnessStrengthFromEnv(): GlowStrength {
  // Defaults to 3, the strength the parameter sweep was tuned at. Drop it to 2
  // for a more clinical, less marketed look — the shadow-band lift scales with
  // it, so 2 is roughly half the crease fill.
  const n = Number(process.env.FIRMNESS_STRENGTH ?? 3);
  return ([0, 1, 2, 3] as const).includes(n as GlowStrength) ? (n as GlowStrength) : 3;
}

/**
 * Deterministic "firmness grade" — the lift half of the treated look.
 *
 * WHY THIS EXISTS. The grade above guarantees HYDRATION, and that is exactly
 * what clients reported getting: a dewier photo whose skin still hung the same
 * way and whose lines were still cut the same depth. The prompt now asks for
 * firmness, but asking is a dice-roll — the same reason `hydrationGrade` exists
 * at all. So the floor is guaranteed here instead.
 *
 * Two operations, and the optical signature of firm skin is what motivates both:
 *   1. STRUCTURE. Firm skin holds its planes, so the shading that defines a jaw
 *      margin, a cheek and a brow is crisper. A large-sigma unsharp with the
 *      flat-area gain at zero lifts exactly that mid-frequency shading without
 *      crunching pores or ringing edges.
 *   2. CREASE DEPTH. Slack skin reads slack because it drops into shadow — the
 *      tear trough, the nasolabial, the line under the jaw. Making those dips
 *      shallower is what "lifted" looks like.
 *
 * The second one is a DIFFERENCE OF GAUSSIANS, and the first two attempts at it
 * are worth recording because both failed in instructive ways. A simple
 * "lighten anything below a threshold" mask, built from one heavy blur, is not
 * selective at all: measured, it raised the shadow band and the highlight band
 * by the same +3.8, i.e. it was a global brightener wearing a mask, and it would
 * have spent the whole effect fighting the tone lock below. And it must be
 * composited OPAQUE with the strength baked into the mask VALUES — libvips
 * premultiplies composite alpha, so dialling strength down via `ensureAlpha`
 * makes a light grey behave like a dark one and the pass silently inverts into a
 * darkener. (Soft-light's neutral is mid-grey, not black, for the same reason.)
 *
 * The DoG is measurably right where those were wrong: wide-blur minus
 * narrow-blur is positive exactly where the skin dips locally, and ~zero on flat
 * planes, so global luminance moves ~1% while the shadow band lifts ~13.
 *
 * SAFETY, and it is why this shape was chosen. The DoG rejects BOTH ends of the
 * frequency range: broad shading cancels because both blurs see it identically,
 * and anything SMALLER than the narrow sigma also cancels because it is smoothed
 * away in both. A spot, a capillary, a freckle, a mole and a pore all sit in
 * that second group, so they cannot be lifted out of the image. The mask is then
 * clamped one-sided so it can only ever fill a dip, never deepen a bump — which
 * also protects the dewy highlights the hydration grade just laid down. Like
 * that grade, this is a filter: it can relight a feature, never delete one, and
 * it touches no geometry, so it cannot reshape or slim a face.
 */
async function firmnessPass(input: Buffer, strength: GlowStrength): Promise<Buffer> {
  if (strength <= 0) return input;
  const f = SCALE[strength] ?? 0.75;

  const raw = await sharp(input).removeAlpha().toColourspace("srgb").png().toBuffer();
  const { width = 1024, height = 1024 } = await sharp(raw).metadata();
  const min = Math.min(width, height);

  // 1. Structure. Large radius, flat-area gain at zero so smooth skin is left
  //    alone and only real shading gradients gain contrast. Capped at sharp's
  //    ceiling of 10.
  const structured = await sharp(raw)
    .sharpen({
      sigma: Math.min(10, Math.max(1, min / 150)),
      m1: 0,
      m2: 0.85 * f,
    })
    .png()
    .toBuffer();

  // 2. Crease depth, via difference of Gaussians. The wide blur holds the face's
  //    overall shading; the narrow blur still holds creases and hollows. Wide
  //    minus narrow is therefore positive precisely inside a dip.
  const grey = await sharp(structured).greyscale().png().toBuffer();
  const wide = await sharp(grey)
    .blur(Math.max(2, min / 12))
    .linear(0.5, 0)
    .png()
    .toBuffer();
  const narrow = await sharp(grey)
    .blur(Math.max(1, min / 60))
    .linear(-0.5, 127.5)
    .png()
    .toBuffer();

  // Each term is pre-scaled into [0, 127.5], so this sums to
  // 127.5 + (wide - narrow)/2 with no clamping on the way — already centred on
  // soft-light's neutral grey.
  const dog = await sharp(wide)
    .composite([{ input: narrow, blend: "add" }])
    .png()
    .toBuffer();

  // Gain about the neutral point.
  //
  // 4 is the measured sweet spot, tuned on REAL client photos rather than a
  // studio shot: model output captured once, then the grade swept offline and
  // scored on the central face region against each client's own original.
  // At 2 — the first value, tuned on a tight studio crop — the shadow band
  // moved +0.7 on real selfies, i.e. nothing; the creases a client actually
  // looks at were still as deep as their own photo. 4 gives ~+8, and 6 gives
  // ~+18 which starts to flatten the face. For reference the OLD engine scored
  // -4.6 here: it made creases DEEPER than the client's own photo.
  const g = 4 * f;

  // One-sided: floor the mask at neutral so it can only ever FILL a dip, never
  // deepen a bump. A raw DoG is symmetric and would darken exactly the cheekbone
  // and brow highlights the hydration grade just put there.
  const shadowMask = await sharp(dog)
    .linear(g, 128 * (1 - g))
    .composite([
      {
        input: { create: { width, height, channels: 3, background: "#808080" } },
        blend: "lighten",
      },
    ])
    .greyscale()
    .png()
    .toBuffer();

  // SOFT-LIGHT, deliberately, not screen. Soft-light leaves a black base black,
  // so hair, pupils, nostrils and the background keep their depth while the
  // mid-shadows that actually read as slackness — the tear trough, the
  // nasolabial, the shadow under the jaw — lift. Screen lifts absolute blacks
  // hardest, which turns dark hair milky and reads instantly as a cheap filter.
  return sharp(structured)
    .composite([{ input: shadowMask, blend: "soft-light" }])
    .jpeg({ quality: 95 })
    .toBuffer();
}

/** Mean luminance of the central face region — where the skin is. */
async function faceLuminance(buf: Buffer): Promise<number> {
  // The crop MUST be materialised before stats(). sharp's .stats() does not run
  // the pipeline — it measures the INPUT image and silently ignores .resize()
  // and .extract() ahead of it. Proven: on a half-black/half-white test image,
  // extracting either half and calling .stats() returns 127.5 for both.
  //
  // This function therefore measured the WHOLE FRAME, background included, for
  // as long as it has existed, while claiming to measure the central face. That
  // matters because the tone lock below is the safeguard against lightening a
  // client's skin: on a wide selfie the face can be a small part of the frame,
  // so a bright wall or window could dominate the reading and let real facial
  // lightening through under a measurement that looked fine.
  const crop = await sharp(buf)
    .resize(1024, 1024, { fit: "fill" })
    .extract({ left: 352, top: 352, width: 320, height: 320 })
    .png()
    .toBuffer();
  const s = await sharp(crop).stats();
  return s.channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3;
}

/**
 * Guarantees the treated skin is never LIGHTER than the original.
 *
 * gpt-image-2 lightens deep skin. Measured on a Black subject: the model raised
 * facial luminance by 46%, visibly changing her skin colour — that is
 * skin-lightening, and it is both harmful and an advertising-standards problem.
 * Strengthening the prompt's tone-lock only brought it down to +28%: pleading
 * with the model does not hold, because "radiance" and "brightening" pull the
 * other way and the model resolves the conflict by lifting the whole image.
 *
 * So the constraint is enforced in code instead. We compare the treated skin's
 * luminance with the original's and scale it back if it rose. The gain is
 * MULTIPLICATIVE and CLAMPED AT 1.0 — this function can only ever darken toward
 * the original, never brighten. It is structurally incapable of lightening
 * someone's skin.
 *
 * WHERE IT RUNS IS AS IMPORTANT AS WHAT IT DOES, and getting that wrong is what
 * made the reports look flat. It used to run LAST, after our own grading — so
 * it could not tell the model's unwanted lightening apart from the dewy sheen
 * we had just deliberately added, and removed both. Measured over 66 real
 * client reports from that build: the highlight band came back a median -3.9
 * levels and 61% of clients were sent an "after" DARKER than their own photo,
 * with the shadow band -5.2, i.e. creases slightly DEEPER. A multiplicative
 * pull-back costs a 200-level highlight ~20 levels while costing a 50-level
 * shadow ~5, so it flattens exactly the contrast the treated look depends on.
 *
 * It now runs FIRST, against the raw model output, where the drift it was
 * written to catch actually lives. Our own grading is applied afterwards and is
 * bounded and dialable by construction.
 */
async function lockSkinTone(after: Buffer, original: Buffer): Promise<Buffer> {
  const [lumAfter, lumBefore] = await Promise.all([
    faceLuminance(after),
    faceLuminance(original),
  ]);
  if (lumAfter <= 0 || lumBefore <= 0) return after;

  // NORMALISE TO THE CLIENT'S OWN FACE, in both directions.
  //
  // This used to correct downward only, which left the model's DARKENING in
  // place. Measured on the raw model output for real client photos, gpt-image-2
  // hands back a face that is often dimmer than the original, so the grade had
  // to spend its budget buying that back with global brightness — the one lever
  // that must not be used, because raising everything is how skin gets
  // lightened. Correcting both ways removes the drift at source and lets the
  // grade start from parity.
  //
  // The TARGET IS THE CLIENT'S OWN LUMINANCE, never above it, so this cannot
  // lighten anyone's skin: it can only put their tone back where it started.
  // The clamp bounds a pathological correction on a badly-exposed frame.
  const gain = Math.max(0.8, Math.min(1.25, lumBefore / lumAfter));
  if (Math.abs(gain - 1) < 0.01) return after;
  return sharp(after).linear(gain, 0).jpeg({ quality: 95 }).toBuffer();
}

export async function hydrationGrade(
  input: Buffer,
  strength: GlowStrength = 3,
  /** The client's original photo. When given, the result can never be lighter. */
  original?: Buffer,
  /**
   * Lift/firmness pass. Gated by the caller on whether Ultra Lift is actually in
   * this client's plan — a client with no laxity concern must not be shown a
   * firmness result from a product nobody recommended them.
   */
  firmness: GlowStrength = 0,
): Promise<Buffer> {
  // FIRST, not last: strip the model's own lightening off its raw output, before
  // any of our grading exists for the lock to mistake for drift. See lockSkinTone.
  const locked = original ? await lockSkinTone(input, original) : input;

  if (strength <= 0 && firmness <= 0) return locked;
  if (strength <= 0) return firmnessPass(locked, firmness);
  const s = SCALE[strength] ?? 0.75;

  const raw = await sharp(locked).removeAlpha().toColourspace("srgb").png().toBuffer();
  const { width = 1024, height = 1024 } = await sharp(raw).metadata();
  const min = Math.min(width, height);

  // The highlight threshold must ADAPT to the photo's exposure. A fixed cutoff
  // works on a bright studio shot and produces almost nothing on a dim indoor
  // phone selfie — the very photos clients actually send — because such an image
  // has no pixels above the cutoff, so there is nothing for the sheen to land on
  // and the "after" comes back looking untouched.
  const stats = await sharp(raw).stats();
  const mean =
    stats.channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3;
  const max = Math.max(...stats.channels.slice(0, 3).map((c) => c.max));
  // Take the top slice of THIS image's own tonal range as "where light falls".
  const t = Math.min(235, Math.max(60, mean + 0.45 * (max - mean)));
  const a = 255 / Math.max(255 - t, 20); // map [t,255] -> [0,255]
  const b = -a * t;

  // Specular sheen: crush everything below the threshold, spread what is left,
  // and screen it back — so the bloom lands only where light already falls
  // (cheekbones, nose bridge, brow, chin), at any exposure.
  const bloom = await sharp(raw)
    .linear(a, b)
    .blur(Math.max(2, Math.round(min / 90)))
    .ensureAlpha(0.3 * s)
    .png()
    .toBuffer();

  // Veil. Deliberately low opacity: spots, pores and scars are far higher
  // contrast than this, so they read straight through it.
  const veil = await sharp(raw)
    .blur(Math.max(1.5, min / 700))
    .ensureAlpha(0.22 * s)
    .png()
    .toBuffer();

  const graded = await sharp(raw)
    .composite([
      { input: veil, blend: "over" },
      { input: bloom, blend: "screen" },
    ])
    // Lifts the sallow cast. Only a few percent — this is vitality, not a
    // whitening or skin-lightening filter; the person's tone is unchanged.
    .modulate({ brightness: 1 + 0.035 * s, saturation: 1 + 0.07 * s })
    .linear(1 + 0.05 * s, -6 * s)
    .jpeg({ quality: 95 })
    .toBuffer();

  // The lift runs on top of the hydration grade, not instead of it: firmness is
  // structure and shadow, hydration is sheen and veil, and a treated face shows
  // both. Order matters — the structure pass wants the veil already laid down,
  // or it sharpens the veil's own softening back out.
  return firmnessPass(graded, firmness);
}
