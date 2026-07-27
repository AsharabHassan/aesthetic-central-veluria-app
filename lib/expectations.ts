import type { AnalysisCategory } from "./types";

/**
 * Per-category calibration for the realistic improvement a client can expect
 * from a full course of the matched Veluria product (3 sessions for Silk Skin
 * and Pearl Tone, 5 for Ultra Lift).
 *
 * Ceilings are grounded in what hydrating / collagen-stimulating boosters
 * actually deliver — visible gains in hydration, radiance, texture, tone and
 * softened fine lines — NOT dramatic, filler-style change. The expected gain
 * scales with how much visible room a category has (lower score => more
 * headroom => bigger expected gain), capped at the evidence-based ceiling.
 */
type Calibration = {
  /** "gain" => skin gets better by X%. "softened" => lines softened by ~X%. */
  kind: "gain" | "softened";
  /** Fraction of the remaining headroom (100 - score) we expect to recover. */
  factor: number;
  /** Minimum expected effect, so even great skin shows a believable lift. */
  floor: number;
  /** Realistic maximum for this category over 3 sessions. */
  ceiling: number;
};

// Ceilings are deliberately conservative: no claim may ever reach 40%, so the
// furthest any category can be projected is its current score plus 30 points,
// and only Hydration and Radiance can reach even that.
//
// "Tone & redness" now HAS a calibration. It used to be deliberately absent —
// the category returned a "beyond a skin booster" flag instead — on the belief
// that Veluria could not touch tone. That was wrong: Veluria Pearl Tone
// (glutathione) is sold specifically to even tone and soften hyperpigmentation,
// so refusing the category was dismissing the concern the product exists to
// treat. It is kept the most conservative of the four: pigment is softened and
// evened, never erased, and visible vessels are still out of scope (they are
// caught by area/treatment text, not by the category).
//
// "Firmness & elasticity" is deliberately the MOST conservative row in the
// table, and that is a judgement about the evidence rather than about the
// product. The hard numbers behind it are thin: the manufacturer's own trial of
// the collagenase + DMAE platform (n=22, 28 days) measured elasticity +11%
// (p<0.05) but firmness +4% (p>0.05, NOT significant). The wider DMAE evidence
// — Grossman 2005 and Uhoda 2002 — is real but describes a modest effect, and
// microneedling's own collagen-induction figures come from longer courses than
// five sessions. So the category earns a badge, because refusing it was the
// original mistake, but the smallest one on the board.
const CALIBRATIONS: Record<string, Calibration> = {
  Hydration: { kind: "gain", factor: 0.5, floor: 15, ceiling: 30 },
  Radiance: { kind: "gain", factor: 0.45, floor: 15, ceiling: 30 },
  "Texture & pores": { kind: "gain", factor: 0.4, floor: 12, ceiling: 25 },
  "Tone & redness": { kind: "gain", factor: 0.35, floor: 10, ceiling: 25 },
  "Fine lines": { kind: "softened", factor: 0.35, floor: 10, ceiling: 25 },
  "Firmness & elasticity": { kind: "gain", factor: 0.3, floor: 10, ceiling: 20 },
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** Round to the nearest 5 for clean, non-spuriously-precise ranges. */
const snap5 = (n: number) => Math.round(n / 5) * 5;

/**
 * Nothing ever projects to a perfect hundred. Skin that scores 97 is skin at
 * the top of what this scale describes, and a report that promised 100 would be
 * promising perfection to someone who can see their own face.
 */
const SCORE_CEILING = 97;

export interface ExpectedImprovement {
  kind: "gain" | "softened" | "consult";
  /** Low end of the expected range (percent). */
  low: number;
  /** High end of the expected range (percent). */
  high: number;
  /** The category's score today. */
  from: number;
  /** Where the full Veluria programme can take it. */
  to: number;
  /** Short label for UI, e.g. "48 → 68". */
  label: string;
}

/**
 * Honest flag for concerns genuinely outside the Veluria range — active acne,
 * visible vessels, structural volume, moles, deeply pitted scars. Rendered as an
 * amber pill so the report acknowledges the concern instead of skipping it.
 */
const CONSULT: ExpectedImprovement = {
  kind: "consult",
  low: 0,
  high: 0,
  from: 0,
  to: 0,
  label: "Beyond Veluria — consult the clinician",
};

/**
 * Turn a Claude skin-category score into an honest, deterministic expectation
 * of what the full Veluria programme can reach. Returns null for categories a
 * booster does not meaningfully address (so the UI can stay silent rather than
 * over-promise).
 *
 * THE LABEL IS A DESTINATION, NOT A DELTA, and that is the whole point of the
 * change. The maths and the ceilings below are exactly what they were; only the
 * framing moved. "+10–20%" beside a photograph of your own face reads as
 * "barely worth it" — it is a small number about an increment. "48 → 68" is the
 * same claim stated as somewhere to arrive, which is what anyone is actually
 * deciding whether to book for.
 *
 * NO SESSION COUNT APPEARS HERE ANY MORE. It used to close every label
 * ("+10–20% after 5 sessions"), and it should not have: how many sessions
 * someone needs is a prescribing decision that belongs to the doctor at the
 * consultation. The report's job is to show where the skin can get to and then
 * hand the client to someone qualified to say how.
 */
export function expectedImprovement(
  category: AnalysisCategory,
): ExpectedImprovement | null {
  const cal = CALIBRATIONS[category.label];
  if (!cal) return null;

  const score = clamp(category.score, 0, 100);
  const headroom = 100 - score;
  const mid = clamp(headroom * cal.factor, cal.floor, cal.ceiling);

  let low = snap5(clamp(mid - 5, cal.floor, cal.ceiling));
  let high = snap5(clamp(mid + 5, cal.floor, cal.ceiling));
  if (low === high) low = Math.max(0, low - 5); // keep it a visible range

  // The destination is the top of this category's own calibrated range — the
  // full programme is what the report now depicts, so the high end is the
  // honest end to show. It is still bounded by the same ceiling as before: no
  // claim was widened to produce a bigger number here.
  const from = Math.round(score);
  const to = Math.round(clamp(from + high, from, SCORE_CEILING));

  return { kind: cal.kind, low, high, from, to, label: `${from} → ${to}` };
}

/**
 * The one number at the top of the report: overall skin today, and where the
 * full programme can take it.
 *
 * Averaged across every category that has a calibration, so it is the same
 * arithmetic the six individual bars show, summed — not a separate claim laid
 * on top of them. Categories the range does not address are excluded rather
 * than counted as zero improvement, which would drag the headline below what
 * the bars beneath it say and make the page argue with itself.
 */
export function overallProjection(
  categories: AnalysisCategory[],
): { from: number; to: number } | null {
  const projected = (categories ?? [])
    .map((c) => expectedImprovement(c))
    .filter((e): e is ExpectedImprovement => e !== null && e.kind !== "consult");

  if (projected.length === 0) return null;

  const mean = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length;
  return {
    from: Math.round(mean(projected.map((p) => p.from))),
    to: Math.round(mean(projected.map((p) => p.to))),
  };
}

/**
 * Map a free-text annotation area (e.g. "Periorbital lines (crow's feet)") to
 * the skin category it best relates to, so a per-area callout can show the
 * realistic expected improvement for that spot. Keyword-matched, returns the
 * category label or null when nothing sensible matches.
 */
function areaToCategoryLabel(area: string): string | null {
  const a = area.toLowerCase();
  // Laxity FIRST, and the order is load-bearing: the canonical area name is
  // "Jawline & lower-face skin laxity", and "jawline" contains "line", so the
  // fine-lines rule below swallowed every laxity callout before it could be
  // matched. Ultra Lift's headline concern was being priced as a wrinkle.
  if (/(laxity|lax|sag|firm|elastic|jawline|jowl|contour)/.test(a))
    return "Firmness & elasticity";
  if (/(line|wrinkle|crease|crow|forehead|glabella|frown|perioral|marionette|nasolabial|fold)/.test(a))
    return "Fine lines";
  if (/(texture|pore|rough|smooth)/.test(a)) return "Texture & pores";
  if (/(redness|red|tone|pigment|blotch|even|dark spot|melasma)/.test(a))
    return "Tone & redness";
  if (/(radian|glow|dull|luminos|bright)/.test(a)) return "Radiance";
  if (/(hydrat|dry|dehydrat|plump|cheek|under-eye|tear trough)/.test(a))
    return "Hydration";
  return null;
}

/**
 * Keywords that mark a concern genuinely outside the Veluria range.
 *
 * This list used to also catch redness, pigmentation, dark spots, melasma and
 * scarring — which meant the report told clients their main concern was
 * untreatable. It is not: Pearl Tone targets tone and hyperpigmentation, and
 * Silk Skin's PDRN targets post-acne marks and calms irritated-looking redness.
 * Blocking them was dismissing the concerns the product is sold against.
 *
 * What remains here is what Veluria really cannot do: ACTIVE acne, visible
 * VESSELS (vascular), structural volume, moles/lesions, and deeply pitted scars.
 *
 * The bare token `hollow` was removed for the same reason. It matched every
 * "Tear trough / under-eye" callout whose concern text mentioned hollowing, so
 * the report answered one of the commonest concerns people book for with an
 * amber "Beyond Veluria" pill and no number at all. Dark circles are a mix of
 * pigment, thin translucent skin and lost volume; Veluria genuinely improves the
 * first two. Only the volume is out of scope, and `volume loss` still catches
 * that — as does TREATMENT_OUT_OF_SCOPE below, which trusts Claude's own
 * sentence when it judges a particular under-eye to be structural.
 */
const OUT_OF_SCOPE =
  /(active acne|inflammatory acne|cystic|pustule|breakout|capillar|thread vein|telangiectas|broken vein|vascular|nasolabial|marionette|deep fold|static fold|volume loss|\bmole\b|skin tag|lesion|ice.?pick|pitted)/i;

/** Claude marks untreatable concerns in the treatment sentence — trust it. */
const TREATMENT_OUT_OF_SCOPE =
  /(beyond|outside|not something).{0,40}(veluria|skin booster)|(veluria|skin booster) (does not|doesn't|cannot|can't|won't)/i;

/**
 * Expected improvement for a specific flagged area, resolved through the
 * matching category's current score. NEVER returns a percentage for an
 * out-of-scope concern — those get the consult flag instead, decided from
 * the area name, the concern text AND Claude's own treatment sentence.
 * Returns null when the area maps to no category or that category is absent.
 */
export function expectedForArea(
  area: string,
  categories: AnalysisCategory[],
  opts?: { concern?: string; treatment?: string },
): ExpectedImprovement | null {
  const text = `${area} ${opts?.concern ?? ""}`.toLowerCase();
  if (OUT_OF_SCOPE.test(text)) return CONSULT;
  if (opts?.treatment && TREATMENT_OUT_OF_SCOPE.test(opts.treatment))
    return CONSULT;
  const label = areaToCategoryLabel(area);
  if (!label) return null;
  const category = categories.find((c) => c.label === label);
  if (!category) return null;

  // The label is the destination the category resolves to, with no session
  // count attached — `productFor` still gates scope above, but how long a
  // course runs is the doctor's to say, not this file's.
  return expectedImprovement(category);
}
