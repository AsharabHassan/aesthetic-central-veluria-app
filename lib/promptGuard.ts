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
 * Two failure modes, and the first is about quality rather than caution:
 *
 *  - STRUCTURE LANGUAGE MAKES THE PICTURE WORSE. Measured on this pipeline, a
 *    brief asking for skin that is "rebuilt", "firmer", "denser" or "plumped
 *    from beneath" dropped the visible change from 25.2 to 5.9 — the model
 *    spends the edit trying to render something it cannot, and hands back a
 *    near-identical frame. A brief that drifts into structure is worse than the
 *    template, so it is rejected in favour of it.
 *
 *  - CLAIM DRIFT. Removing a mole, erasing a scar, or lightening skin are
 *    claims the clinic cannot make. Those must never reach the API at all.
 *
 * Rejection is silent and safe: the caller falls back to buildZonePrompt.
 */

/**
 * Word-boundaried at BOTH ends, and that is load-bearing rather than tidiness:
 * unanchored, "age" matches inside "image" and every brief that mentions the
 * photograph gets thrown away. It also stops "firm" matching "confirm" and
 * "fill" matching "fulfilled".
 */
const FORBIDDEN =
  /\b(lift|lifted|lifting|tighten\w*|firm|firmer|firmness|firming|firmed|rebuild\w*|rebuilt|dense|denser|density|plump\w*|volume|filler|fill|filled|filling|contour\w*|jawline|jaw line|bone structure|slim\w*|narrow\w*|reshape\w*|younger|youthful|age|remove|removes|removed|erase|erases|erased|eliminate|eliminates|eliminated|whiten\w*|lighten\w*|paler|bleach\w*)\b/i;

/** Below this it is not a brief; above it we are back to the bloated shape. */
const MIN_LENGTH = 120;
const MAX_LENGTH = 1800;

/** Claude's photographic brief, or null when it cannot be trusted. */
export function parseImagePrompt(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < MIN_LENGTH || t.length > MAX_LENGTH) return null;
  if (FORBIDDEN.test(t)) return null;
  return t;
}

/** Exposed so the behaviour can be exercised directly. */
export const _FORBIDDEN = FORBIDDEN;
