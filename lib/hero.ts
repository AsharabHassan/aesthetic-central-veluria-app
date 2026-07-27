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
  /** e.g. "+10–20% after 5 sessions" — the same badge the report shows. */
  expectedLabel: string;
}

/**
 * Picks the worst IN-SCOPE annotation: highest severity first, then the largest
 * expected improvement.
 *
 * Scope is decided by the two existing gatekeepers rather than a third opinion:
 * `expectedForArea` returns the "consult" sentinel for anything outside the
 * range (checking the area, the concern text AND Claude's own treatment
 * sentence), and `productFor` returns null for the same. Agreeing with both is
 * deliberate — it means the hero can never drift away from what the report
 * tells the client on the same page.
 */
export function heroZone(
  annotations: FaceAnnotation[] | undefined,
  categories: AnalysisCategory[],
): HeroZone | null {
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

  if (candidates.length === 0) return null;

  candidates.sort((p, q) => {
    const bySeverity =
      (SEVERITY_RANK[q.a.severity] ?? 0) - (SEVERITY_RANK[p.a.severity] ?? 0);
    if (bySeverity !== 0) return bySeverity;
    return q.expected.high - p.expected.high;
  });

  const { a, expected, product } = candidates[0];
  return {
    area: a.area,
    concern: a.concern,
    // Clamped so a stray estimate can never crop outside the photo.
    x: Math.max(0, Math.min(100, a.x)),
    y: Math.max(0, Math.min(100, a.y)),
    product,
    expectedLabel: expected.label,
  };
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
