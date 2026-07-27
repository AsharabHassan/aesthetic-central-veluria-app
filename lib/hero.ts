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
  /** So a crop's marker matches its row in the callout list above it. */
  severity: string;
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
  const candidates = (annotations ?? [])
    .map((a) => {
      const expected = expectedForArea(a.area, categories, {
        concern: a.concern,
        treatment: a.treatment,
      });
      if (!expected || expected.kind === "consult") return null;
      const product = productFor(a.area, a.concern);
      if (!product) return null;
      return { a, expected, product };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  candidates.sort((p, q) => {
    const bySeverity =
      (SEVERITY_RANK[q.a.severity] ?? 0) - (SEVERITY_RANK[p.a.severity] ?? 0);
    if (bySeverity !== 0) return bySeverity;
    return q.expected.high - p.expected.high;
  });

  return candidates.map(({ a, expected, product }) => ({
    area: a.area,
    concern: a.concern,
    // Clamped so a stray estimate can never crop outside the photo.
    x: Math.max(0, Math.min(100, a.x)),
    y: Math.max(0, Math.min(100, a.y)),
    product,
    expectedLabel: expected.label,
    treatment: a.treatment,
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
