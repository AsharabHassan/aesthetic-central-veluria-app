import { productFor } from "./veluria";
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
// biggest badge the UI can produce is "+25–30%".
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

/**
 * Course length per category, because it is not a blanket 3. Ultra Lift — the
 * product that answers firmness — is a five-vial, five-session course, so a
 * "+X% after 3 sessions" badge on the firmness bar would under-state the
 * protocol and mis-price the plan the client is about to be quoted.
 */
const CATEGORY_SESSIONS: Record<string, number> = {
  "Firmness & elasticity": 5,
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** Round to the nearest 5 for clean, non-spuriously-precise ranges. */
const snap5 = (n: number) => Math.round(n / 5) * 5;

export interface ExpectedImprovement {
  kind: "gain" | "softened" | "consult";
  /** Low end of the expected range (percent). */
  low: number;
  /** High end of the expected range (percent). */
  high: number;
  /** Short label for UI, e.g. "+30–40% after 3 sessions" or "softened ~20%". */
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
  label: "Beyond Veluria — consult the clinician",
};

/**
 * Turn a Claude skin-category score into an honest, deterministic expectation
 * of improvement after 3 sessions. Returns null for categories a booster does
 * not meaningfully address (so the UI can stay silent rather than over-promise).
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

  const sessions = CATEGORY_SESSIONS[category.label] ?? 3;
  const label =
    cal.kind === "softened"
      ? `softened ~${snap5(mid)}%`
      : `+${low}–${high}% after ${sessions} sessions`;

  return { kind: cal.kind, low, high, label };
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

  const expected = expectedImprovement(category);
  if (!expected || expected.kind !== "gain") return expected;

  // The course length is the PRODUCT's, not a blanket 3. Ultra Lift — the one
  // that answers laxity and jawline concerns — is a five-vial, five-session
  // course, so a "+X% after 3 sessions" badge on a laxity callout would
  // under-state the protocol and mis-price the plan.
  const product = productFor(area, opts?.concern ?? "");
  if (!product) return expected;
  return {
    ...expected,
    label: `+${expected.low}–${expected.high}% after ${product.sessions} sessions`,
  };
}
