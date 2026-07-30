import { expectedForArea } from "./expectations";
import { productFor, type VeluriaProduct } from "./veluria";
import type { AnalysisCategory, FaceAnnotation } from "./types";

/**
 * The ONE area the simulated result leads on.
 *
 * WHY THIS EXISTS. The after-image used to ask for improvement everywhere on the
 * face at once, and the deterministic grade in lib/glow.ts is a whole-frame
 * filter, so the change was spread evenly across the whole photo. Evenly spread
 * change is the hardest kind to see: the eye compares LOCALLY against a
 * reference and is close to blind to a uniform shift. Clients looked at a face
 * where everything had moved a little, nothing had moved a lot, and reported
 * that nothing had happened — then did not book.
 *
 * So one area is promoted. The prompt concentrates the visible improvement
 * there, and components/HeroZoom.tsx crops that exact region out of BOTH images
 * at 2x and puts them side by side, which is the comparison the slider never
 * makes. The rest of the face still improves; it simply stops competing for
 * attention with the thing we want the client to look at.
 *
 * NOTHING HERE WIDENS A CLAIM. The hero can only ever be an area the range
 * genuinely treats — out-of-scope concerns are filtered out below, using the
 * same two functions the report and the image prompt already use, so an active
 * breakout or a structural hollow can never become the headline.
 */

const SEVERITY_RANK: Record<string, number> = {
  notable: 3,
  moderate: 2,
  low: 1,
};

/**
 * The severity palette, in ONE place.
 *
 * The page shows the same set of areas three times — the callout list, the
 * close-up reel and the treatment map — and each carried its own colour scale.
 * The map used a different red, a different amber and a different green from
 * the other two, so a client comparing "the red one" across sections was
 * comparing different colours for the same severity.
 */
export const SEVERITY_DOT: Record<string, string> = {
  notable: "bg-[#d4574b]",
  moderate: "bg-[#d9a441]",
  low: "bg-[#6fae5f]",
};

/** The same three, as raw hex, for SVG/inline styles (the map's pins). */
export const SEVERITY_HEX: Record<string, string> = {
  notable: "#d4574b",
  moderate: "#d9a441",
  low: "#6fae5f",
};

/**
 * THE canonical annotation list: de-duplicated by area, worst first.
 *
 * WHY IT EXISTS. Three components rendered the same concerns independently and
 * disagreed with each other in two visible ways.
 *
 * DUPLICATES. Claude regularly returns two annotations naming the same area,
 * and the prompt actively encourages it for the under-eye (it asks the model to
 * separate the treatable skin component from the untreatable volume component).
 * `expectedForArea` derives its badge from the AREA, but is also sensitive to
 * the concern and treatment text — so one real report rendered two rows both
 * titled "Tear trough / under-eye", one badged "68 → 88" and the other "Beyond
 * Veluria — consult the clinician". The same area, told two different stories,
 * one line apart.
 *
 * NUMBERING. The callout list numbered over Claude's raw order, the reel over a
 * filtered and re-sorted list, and the map over the raw order again — so badge
 * "3" pointed at a different area in each of the three places it appeared.
 *
 * Everything now derives from this one ordered list, and a zone carries its
 * position in it (see HeroZone.index) so the numbers survive filtering.
 *
 * OUT-OF-SCOPE CONCERNS ARE KEPT HERE, deliberately. They are honest and
 * valuable on the page — "Beyond Veluria — consult the clinician" is exactly
 * the kind of candour that earns a consultation. They are filtered out only for
 * the close-up reel, by `concernZones`, so nothing outside the range ever
 * acquires an image implying we treated it.
 */
export function canonicalAnnotations(
  annotations: FaceAnnotation[] | undefined,
): FaceAnnotation[] {
  const seen = new Set<string>();
  const unique = (annotations ?? []).filter((a) => {
    const key = a.area?.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Stable sort by severity, so Claude's own ordering survives within a band.
  return unique
    .map((a, i) => ({ a, i }))
    .sort(
      (p, q) =>
        (SEVERITY_RANK[q.a.severity] ?? 0) - (SEVERITY_RANK[p.a.severity] ?? 0) ||
        p.i - q.i,
    )
    .map(({ a }) => a);
}

/**
 * The part of the hero the image prompt needs. Kept separate from HeroZone so
 * the transform route can validate an untrusted request body into something
 * honest, instead of casting a half-built object into the full UI shape.
 */
export interface HeroFocus {
  area: string;
  concern: string;
}

export interface HeroZone extends HeroFocus {
  /** Position as a percentage of the (square) image, straight from the analysis. */
  x: number;
  y: number;
  product: VeluriaProduct;
  /** e.g. "48 → 68" — the same destination badge the report shows. */
  expectedLabel: string;
  /** Claude's own treatment sentence for this area, already claim-checked. */
  treatment: string;
  /** Claude's photographic brief for this area's close-up. May be empty. */
  imagePrompt?: string;
  /** So a crop's marker matches its row in the callout list above it. */
  severity: string;
  /**
   * 1-based position in the CANONICAL list — see canonicalAnnotations.
   *
   * Not the index in this filtered array. The reel drops out-of-scope concerns
   * and the callout list keeps them, so numbering off each list's own position
   * made badge "3" point at a different area in each place it appeared.
   */
  index: number;
}

/**
 * EVERY in-scope annotation, worst first: highest severity, then the largest
 * expected improvement.
 *
 * WHY IT RETURNS ALL OF THEM NOW. This file used to expose only the single
 * worst area, because the whole-face slider was proving nothing and one tight
 * crop at 2x was the fix. That was right, and it did not go far enough: one
 * crop is one piece of evidence, and every other concern the client was told
 * about stayed a line of text with a percentage beside it. A client with six
 * flagged areas saw their skin improve once and read about it five times.
 *
 * Six crops is six separate moments of "oh — that actually changed", each one
 * a comparison the eye can make in a single fixation. Accumulated proof is what
 * the page was missing.
 *
 * Scope is decided by the two existing gatekeepers rather than a third opinion:
 * `expectedForArea` returns the "consult" sentinel for anything outside the
 * range (checking the area, the concern text AND Claude's own treatment
 * sentence), and `productFor` returns null for the same. Agreeing with both is
 * deliberate — it means a zone can never drift away from what the report tells
 * the client on the same page, and an out-of-scope concern can never acquire a
 * crop that implies we treated it.
 */
export function concernZones(
  annotations: FaceAnnotation[] | undefined,
  categories: AnalysisCategory[],
): HeroZone[] {
  // Derived from the canonical list, so the reel can never disagree with the
  // callout list or the treatment map about which areas exist, what order they
  // are in, or what number each one carries.
  const canonical = canonicalAnnotations(annotations);
  const position = new Map<FaceAnnotation, number>(
    canonical.map((a, i) => [a, i + 1]),
  );

  const candidates = canonical
    .map((a) => {
      const expected = expectedForArea(a.area, categories, {
        concern: a.concern,
        treatment: a.treatment,
        scope: a.scope,
      });
      if (!expected || expected.kind === "consult") return null;
      const product = productFor(a.area, a.concern);
      if (!product) return null;
      return { a, expected, product };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // NO FURTHER SORTING, and no de-duplication here — canonicalAnnotations has
  // already done both. This used to re-sort by `expected.high` within a
  // severity band, which silently reordered the reel relative to the callout
  // list built from the same concerns. Canonical order is the order, everywhere.

  return candidates.map(({ a, expected, product }) => ({
    index: position.get(a) ?? 1,
    area: a.area,
    concern: a.concern,
    // Clamped so a stray estimate can never crop outside the photo.
    x: Math.max(0, Math.min(100, a.x)),
    y: Math.max(0, Math.min(100, a.y)),
    product,
    expectedLabel: expected.label,
    treatment: a.treatment,
    imagePrompt: a.imagePrompt,
    severity: a.severity,
  }));
}

/**
 * The one area the image prompt leads on: the worst in-scope concern.
 *
 * Still a single zone, because the reason for it is unchanged — the prompt
 * concentrates the largest change in the frame on one place so that change
 * survives being cropped. The crop reel shows every zone; the IMAGE still has
 * a headline.
 */
export function heroZone(
  annotations: FaceAnnotation[] | undefined,
  categories: AnalysisCategory[],
): HeroZone | null {
  return concernZones(annotations, categories)[0] ?? null;
}

/**
 * Reorders concerns so the hero is first.
 *
 * The transform route caps how many concerns reach the image, and the prompt
 * weights the first bullet most heavily, so the headline area must not be
 * sitting in position six where it can be truncated away.
 */
export function heroFirst<T extends { area: string; concern: string }>(
  concerns: T[],
  hero: HeroZone | null,
): T[] {
  if (!hero) return concerns;
  const i = concerns.findIndex(
    (c) => c.area === hero.area && c.concern === hero.concern,
  );
  if (i <= 0) return concerns;
  return [concerns[i], ...concerns.slice(0, i), ...concerns.slice(i + 1)];
}
