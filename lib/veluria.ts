/**
 * The Veluria range — the app's single source of truth for what the product can
 * and cannot do.
 *
 * WHY THIS EXISTS. The app used to model "Veluria" as ONE hydrating skin booster
 * whose scope was hydration, glow, texture and fine surface lines, and which was
 * declared incapable of touching pigmentation, tone, laxity or scarring. That is
 * wrong, and it was costing bookings: those are the concerns most clients come
 * in with, so the report dismissed them ("beyond a skin booster's scope") and the
 * simulated result showed no change.
 *
 * Veluria is in fact PB Serum's BIOREMODELING line (Proteos Biotech, Spain;
 * Class 3 medical device, professional use only). Every product is built on
 * recombinant Collagenase G & H, which degrades disorganised collagen and drives
 * new collagen synthesis. Three of the four are for skin, and each targets a
 * DIFFERENT concern — including the ones we were refusing:
 *
 *   - Pearl Tone is sold specifically to target hyperpigmentation (glutathione,
 *     a tyrosinase inhibitor).
 *   - Ultra Lift is sold specifically for sagging and loss of firmness (DMAE).
 *   - Silk Skin carries PDRN, among the better-evidenced actives for post-acne
 *     scarring, and is anti-inflammatory (with Centella asiatica) so it calms
 *     irritated-looking redness.
 *
 * CLAIM DISCIPLINE. Everything here is phrased as an APPEARANCE claim, the way
 * the manufacturer phrases it. Veluria softens and evens pigment; it does not
 * erase it. It calms redness; it does not remove blood vessels. Anything genuinely
 * outside the range still says so — see OUT_OF_SCOPE.
 *
 * NOT CLAIMED: exosomes. PB Serum's marketing calls the platform "Exosomes +
 * PDRN + HA", but the Silk Skin INCI lists PDRN, a peptide and Centella with no
 * exosomes. Exosome claims attract ASA/MHRA scrutiny, so we claim only the INCI
 * until Sirona confirms otherwise.
 */

export type VeluriaProductId = "silk-skin" | "ultra-lift" | "pearl-tone";

export interface VeluriaProduct {
  id: VeluriaProductId;
  /** Client-facing name. */
  name: string;
  /** One line, for the report. */
  tagline: string;
  /** Actives, taken from the INCI — not the marketing. */
  actives: string;
  /** Vials in a pack, which is the course length. Ultra Lift is FIVE, not three. */
  sessions: number;
  /** What this product is matched to, in the client's language. */
  treats: string[];
  /**
   * The visible change this product produces, written as the instruction the
   * image model receives. Appearance-level, and honest about limits.
   */
  visibleResult: string;
}

export const VELURIA_PRODUCTS: Record<VeluriaProductId, VeluriaProduct> = {
  "silk-skin": {
    id: "silk-skin",
    name: "Veluria Silk Skin",
    tagline: "Skin quality & texture — the “glass skin” refiner",
    actives: "Collagenase G&H, PDRN, palmitoyl pentapeptide-4, Centella asiatica, hyaluronic acid",
    sessions: 3,
    treats: [
      "rough, uneven texture and enlarged-looking pores",
      "dull, tired, dehydrated skin",
      "fine surface lines and crepiness",
      "post-acne marks and textural scarring",
      "irritated, reactive-looking redness (calming, not vessel removal)",
    ],
    visibleResult:
      "the skin surface is resurfaced into a smooth, even, refined “glass skin” texture; pores read tighter and cleaner; fine lines and crepiness are plumped out; post-acne marks and textural scarring are visibly softened and shallower (still present, but far less pronounced); irritated-looking redness reads calmer and less angry",
  },
  "ultra-lift": {
    id: "ultra-lift",
    name: "Veluria Ultra Lift",
    tagline: "Firmness & elasticity — visible tightening",
    actives: "Collagenase G&H, DMAE, vitamin C (ethyl ascorbic acid), vitamin E, hyaluronic acid",
    sessions: 5,
    treats: [
      "skin laxity and loss of firmness",
      "a softening jawline and lower-face contour",
      "loss of elasticity and “bounce”",
      "tired, devitalised-looking skin",
    ],
    visibleResult:
      "the skin looks firmer, tighter and more elastic — it sits better on the face, the jawline and lower-face contour read more defined and less slack, and the whole face looks lifted and revitalised. This is the SKIN looking tighter: do not reshape the face, slim it, alter the bone structure or add filler-style volume",
  },
  "pearl-tone": {
    id: "pearl-tone",
    name: "Veluria Pearl Tone",
    tagline: "Even tone & radiance — the brightener",
    actives: "Collagenase G&H, glutathione, hyaluronic acid",
    sessions: 3,
    treats: [
      "uneven skin tone and visible colour differences",
      "sun spots, age spots and hyperpigmentation",
      "post-inflammatory marks left by old breakouts",
      "a dull, sallow, grey complexion",
    ],
    visibleResult:
      "the complexion reads clearer and far more EVEN — AT EXACTLY THE SAME SKIN COLOUR AND DEPTH AS THE ORIGINAL. Discrete sun spots, age spots and pigment patches are visibly SOFTENED and less contrasted against the skin around them (still there, just far less obvious). The skin looks luminous because it REFLECTS MORE LIGHT, never because it has become a lighter colour. FRECKLES ARE NOT PIGMENTATION AND ARE NEVER TOUCHED — reproduce every one exactly. Deep skin stays exactly as deep: this is never lightening, bleaching or whitening, and the person's real skin tone and ethnicity are identical",
  },
};

/**
 * Genuinely outside the range. These keep the guardrail Dr Shah asked for — they
 * are simply the *correct* list now, rather than a list that also swept up half
 * the product's actual indications.
 */
export const OUT_OF_SCOPE: { match: RegExp; why: string }[] = [
  {
    match: /(active acne|inflammatory acne|cystic|pustule|breakout|papule|whitehead|blackhead)/i,
    why: "active breakouts need medical management — Veluria works on the marks they leave behind, not on active acne",
  },
  {
    match: /(capillar|thread vein|telangiectas|broken vein|vascular|rosacea)/i,
    why: "visible vessels are vascular and need in-clinic light-based treatment",
  },
  {
    match: /(deep fold|deep static|nasolabial|marionette|volume loss|hollow|tear trough hollow|lip shape)/i,
    why: "this is structural volume, not skin quality — the clinician will advise at consultation",
  },
  {
    match: /(mole|skin tag|lesion|suspicious)/i,
    why: "any lesion needs a clinician's eye and is never treated cosmetically",
  },
  {
    match: /(ice.?pick|deep pitted|atrophic scar)/i,
    why: "deeply pitted scarring may need resurfacing or subcision alongside a booster",
  },
];

export function isOutOfScope(text: string): string | null {
  for (const rule of OUT_OF_SCOPE) if (rule.match.test(text)) return rule.why;
  return null;
}

/**
 * Matches a flagged concern to the Veluria product that actually addresses it.
 * Out-of-scope concerns are checked FIRST so they can never be mis-sold.
 */
export function productFor(area: string, concern: string): VeluriaProduct | null {
  const t = `${area} ${concern}`.toLowerCase();
  if (isOutOfScope(t)) return null;

  // Pearl Tone only on a genuine TONE/PIGMENT signal. Bare "dullness" is not one:
  // it is answered just as well by Silk Skin's hydration and glow, and routing it
  // here would up-sell the brightener to clients with no pigment concern at all.
  if (/(pigment|dark spot|sun spot|age spot|melasma|discolou?r|uneven tone|\btone\b|sallow|blotch|hyperpigment)/.test(t))
    return VELURIA_PRODUCTS["pearl-tone"];
  if (/(laxity|lax|sag|firm|elastic|jawline|jowl|slack|contour)/.test(t))
    return VELURIA_PRODUCTS["ultra-lift"];
  // Everything else in scope is skin quality: texture, pores, fine lines,
  // hydration, glow, dullness, post-acne marks, calm-able redness.
  return VELURIA_PRODUCTS["silk-skin"];
}

/** The distinct products a client's concerns call for — their recommended plan. */
export function planFor(
  concerns: { area: string; concern: string }[],
): VeluriaProduct[] {
  const seen = new Set<VeluriaProductId>();
  const plan: VeluriaProduct[] = [];
  for (const c of concerns) {
    const p = productFor(c.area, c.concern);
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      plan.push(p);
    }
  }
  // Skin quality underpins the whole range: if nothing matched, Silk Skin is the
  // sensible default rather than showing the client no plan at all.
  return plan.length > 0 ? plan : [VELURIA_PRODUCTS["silk-skin"]];
}
