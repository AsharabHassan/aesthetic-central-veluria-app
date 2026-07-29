/**
 * Vetting the image brief Claude writes.
 *
 * WHY A GUARD AT ALL. The per-area close-up prompt is now authored by Claude
 * during the analysis rather than assembled from a template, because Claude is
 * the only thing in the pipeline that has actually looked at the photograph and
 * can describe THIS person's skin. That is a real improvement and it also hands
 * a language model the pen on what a picture claims, so the output is checked
 * before it reaches the image API.
 *
 * TWO LISTS, NOT ONE, and the split matters more than either list's contents.
 * These are different kinds of problem and they deserve different answers:
 *
 *  - UNSAFE is a claim the clinic cannot make — erasing a mole, lightening
 *    skin. Never reaches the API. Non-negotiable.
 *  - STRUCTURE is a quality problem. Measured on this pipeline, a brief asking
 *    for skin that is "rebuilt", "firmer" or "plumped from beneath" dropped the
 *    visible change from 25.2 to 5.9: the model spends the edit trying to render
 *    something it cannot and hands back a near-identical frame.
 *
 * Both used to sit in one regex, so both got the same treatment — silent
 * rejection, silent fallback to the generic template. That was the wrong shape
 * twice over. It threw away a personalised brief over a single word, and it did
 * so with NO LOG LINE, so nobody could see how often it was happening or why
 * every client seemed to be getting the same generic edit.
 *
 * The word list was also too broad and caught ordinary skin writing:
 *   `age`      -> "age spots", a legitimate surface concern
 *   `fill*`    -> "the crease is less filled with shadow", a description of
 *                 light, not of dermal filler
 *   `remove*`  -> only a claim when it has a FEATURE as its object, so it is now
 *                 matched against one rather than banned outright
 * Each of those forced a real brief back to the template for no benefit.
 */

/**
 * Word-boundaried at BOTH ends, and that is load-bearing rather than tidiness:
 * unanchored, "age" matches inside "image" and every brief that mentions the
 * photograph gets thrown away. It also stops "firm" matching "confirm".
 */
const STRUCTURE =
  /\b(lift|lifted|lifting|tighten\w*|firm|firmer|firmness|firming|firmed|rebuild\w*|rebuilt|dense|denser|density|plump\w*|volume|filler|contour\w*|jawline|jaw line|bone structure|slim\w*|narrow\w*|reshape\w*|younger|youthful)\b/i;

/**
 * Erasing a feature — matched against an actual object rather than on the verb
 * alone, so "the dullness is removed" survives and "removes the mole" does not.
 */
const UNSAFE_ERASURE =
  /\b(remove|removes|removed|removing|erase|erases|erased|erasing|eliminate|eliminates|eliminated|eliminating|delete|deletes|deleted|get rid of)\b[^.!?]{0,60}\b(mole|moles|freckle|freckles|scar|scars|blemish|blemishes|lesion|lesions|birthmark|birthmarks|capillary|capillaries|vessel|vessels|tattoo)\b/i;

/**
 * Skin lightening. Kept as an outright ban even though `lockSkinTone` in
 * lib/glow.ts already makes it structurally impossible for the OUTPUT to be
 * lighter than the client's own photograph — because the problem here is the
 * CLAIM, not just the pixels, and an advertising standards question is not
 * answered by a post-process.
 */
const UNSAFE_LIGHTENING_ABSOLUTE = /\b(whiten\w*|bleach\w*)\b/i;

/**
 * A COMPARATIVE, WHICH THE PREVIOUS LIST MISSED ENTIRELY. It banned `whiten\w*`
 * and `lighten\w*`, and neither matches "whiter" or "lighter" — those are
 * white+r and light+er, not whiten+… and lighten+…. So a brief saying "her
 * complexion is noticeably lighter and whiter" passed the guard clean. Caught by
 * asserting the guard against a case it was assumed to handle.
 *
 * Matched only NEAR a skin noun, in either order, because "the shadow under the
 * eye is lighter" is a legitimate description of light and "her skin is lighter"
 * is not. A false positive here costs one generic template; a false negative
 * ships skin-lightening in a clinic's advertising.
 */
const LIGHTER = "lighten\\w*|lighter|lightest|whiter|whitest|fairer|fairest|paler|palest";
const SKIN_NOUN = "skin|complexion|undertone|tone|face";
const UNSAFE_LIGHTENING = new RegExp(
  `\\b(?:${LIGHTER})\\b[^.!?]{0,40}\\b(?:${SKIN_NOUN})\\b` +
    `|\\b(?:${SKIN_NOUN})\\b[^.!?]{0,40}\\b(?:${LIGHTER})\\b`,
  "i",
);

/** Below this it is not a brief; above it we are back to the bloated shape. */
const MIN_LENGTH = 120;
const MAX_LENGTH = 1800;

export type PromptVerdict =
  | { ok: true; prompt: string }
  | { ok: false; reason: "not-a-string" | "too-short" | "too-long" | "unsafe" | "structure"; term?: string };

/**
 * Inspect a brief and say WHY it was refused.
 *
 * The reason is the point. A caller that only learns "null" cannot tell a brief
 * that was 40 characters short from one that named a mole, and cannot log the
 * difference — which is exactly how the template fallback went unnoticed.
 */
export function inspectImagePrompt(v: unknown): PromptVerdict {
  if (typeof v !== "string") return { ok: false, reason: "not-a-string" };
  const t = v.trim();
  if (t.length < MIN_LENGTH) return { ok: false, reason: "too-short" };
  if (t.length > MAX_LENGTH) return { ok: false, reason: "too-long" };

  const erasure = UNSAFE_ERASURE.exec(t);
  if (erasure) return { ok: false, reason: "unsafe", term: erasure[0].slice(0, 60) };
  const absolute = UNSAFE_LIGHTENING_ABSOLUTE.exec(t);
  if (absolute) return { ok: false, reason: "unsafe", term: absolute[0] };
  const lightening = UNSAFE_LIGHTENING.exec(t);
  if (lightening) return { ok: false, reason: "unsafe", term: lightening[0].slice(0, 60) };

  const structure = STRUCTURE.exec(t);
  if (structure) return { ok: false, reason: "structure", term: structure[0] };

  return { ok: true, prompt: t };
}

/** Claude's photographic brief, or null when it cannot be trusted. */
export function parseImagePrompt(v: unknown): string | null {
  const verdict = inspectImagePrompt(v);
  return verdict.ok ? verdict.prompt : null;
}

/** Exposed so the behaviour can be exercised directly. */
export const _STRUCTURE = STRUCTURE;
export const _UNSAFE_ERASURE = UNSAFE_ERASURE;
export const _UNSAFE_LIGHTENING = UNSAFE_LIGHTENING;
export const _UNSAFE_LIGHTENING_ABSOLUTE = UNSAFE_LIGHTENING_ABSOLUTE;
