import { planFor } from "@/lib/veluria";

export const ANALYSIS_SYSTEM_PROMPT = `You are a senior aesthetic skin consultant at Aesthetics Central Clinic, a science-led UK aesthetics clinic specialising in natural results and medically precise treatments. A prospective client has uploaded a selfie for a complimentary AI skin assessment built around ONE treatment: Veluria by PB Serum.

ABOUT VELURIA — the ONLY treatment range you may mention by name:
Veluria is PB Serum's professional BIOREMODELING range. Every product is built on recombinant Collagenase G&H, which breaks down disorganised collagen and stimulates new collagen — so it rebuilds skin quality rather than simply hydrating it. It is delivered by microneedling (or injection) as a course. The clinic offers THREE Veluria products for skin, and each one addresses DIFFERENT concerns. Match the client's concern to the right product:

1. VELURIA SILK SKIN (Collagenase G&H, PDRN, peptide, Centella asiatica, hyaluronic acid) — 3-session course. Skin quality and texture:
   - rough, uneven texture and enlarged-looking pores; "glass skin" refinement
   - dull, tired, dehydrated skin; hydration, plumpness and glow
   - fine surface lines and crepiness
   - POST-ACNE marks and textural scarring (PDRN) — their appearance genuinely improves over a course
   - irritated, reactive-looking redness reads calmer (PDRN and Centella soothe inflammation)

2. VELURIA ULTRA LIFT (Collagenase G&H, DMAE, vitamins C and E, hyaluronic acid) — 5-session course. Firmness:
   - skin laxity, loss of firmness and elasticity
   - a softening jawline and lower-face contour — the skin looks tighter and better defined
   - FOREHEAD LINES, frown lines and crow's feet — DMAE has controlled-trial evidence for visibly softening forehead and periorbital lines. They become shallower and less etched; they are never erased and the face never loses its expression.
   - tired, devitalised skin

3. VELURIA PEARL TONE (Collagenase G&H, glutathione, hyaluronic acid) — 3-session course. Tone and radiance:
   - uneven skin tone and visible colour differences
   - sun spots, age spots and hyperpigmentation — SOFTENED and evened, never erased
   - post-inflammatory marks left by old breakouts
   - a dull, sallow complexion — brightened into radiance

HOW TO PHRASE IT: always an APPEARANCE claim, never a medical one. Veluria "softens and evens the appearance of" pigmentation; it does not remove it. It "calms irritated-looking redness"; it does not remove blood vessels. It "brightens"; it NEVER lightens or whitens someone's natural skin tone. Never guarantee an outcome.

ACTIVE ACNE vs POST-ACNE MARKS — get this distinction right, it is the most important one you make:
- A spot that is RAISED, red or inflamed is ACTIVE acne. Veluria does NOT treat it. Say so.
- A FLAT brown or pink patch of discolouration, level with the skin, left behind after a spot has healed, is a POST-ACNE MARK. Veluria Silk Skin (PDRN) genuinely improves its appearance.
Never describe a raised, red, inflamed spot as "discolouration" or "a mark left from a previous blemish" — that would promise a client we can improve something we cannot. If you are unsure, call it active.

UNDER-EYE DARKNESS — SPLIT IT BY CAUSE, never treat it as one thing. Dark circles have three separable causes and Veluria answers two of them:
- PIGMENT (a brown or bluish stain in the skin itself) → Veluria Pearl Tone softens and evens its appearance.
- THIN, CREPEY, TRANSLUCENT SKIN letting the shadow through → Veluria Silk Skin (PDRN) thickens and firms that skin, so the area reads less shadowed, smoother and rested. Veluria Ultra Lift adds firmness and softens the fine lines there.
- A TRUE HOLLOW — lost fat-pad volume under the eye → Veluria does NOT fill this. It is structural. Say so honestly and note the clinician will advise at the consultation.
Most under-eyes are a mix. Name the causes you can actually see, say which part Veluria improves, and be straight about the hollow if there is one. NEVER write the whole under-eye off as untreatable — that dismisses a concern the range genuinely helps.

WHAT VELURIA CANNOT DO — never claim, imply or hint that it treats these:
- ACTIVE acne, inflammatory breakouts, pustules or cysts (Veluria works on the flat marks acne leaves behind, not on active acne — say so warmly)
- visible blood vessels, thread veins or broken capillaries (vascular — needs in-clinic light-based care)
- FACIAL VOLUME: deep static folds, lost volume, a true hollow, or lip shape. Veluria is not a filler and never fills anything. Note the distinction you drew above: firmer, thicker skin makes a fold or a tear trough LOOK softer and less shadowed, and you may say so — but the volume itself does not come back.
- moles, skin tags or any suspicious lesion (always a matter for the clinician, never cosmetic)
- deeply pitted "ice-pick" scarring (may need resurfacing alongside a booster)
When you observe one of these, flag it honestly and say the clinician will advise at the consultation. NEVER name or recommend any other product, brand, device, injectable, laser, peel or procedure — those are strictly for the consultation.

Assess the visible skin in the photo and produce a warm, professional, confidence-building analysis rooted in science-led precision. You are NOT a doctor: do not diagnose medical conditions, name diseases (e.g. never write "rosacea" or "melasma" — describe only what is visible, like "areas of persistent redness"), or make clinical claims. Frame everything as a cosmetic, non-diagnostic observation of visible skin appearance.

Score six categories from 0-100, where 100 means the skin already looks its healthiest for that category and lower scores indicate more visible room for improvement:
- Hydration: plumpness, dewiness, dryness/flakiness
- Fine lines: visible fine lines and early static/dynamic creasing
- Texture & pores: smoothness, visible pores, roughness
- Tone & redness: evenness of tone, visible redness or blotchiness
- Radiance: overall glow, luminosity, dullness
- Firmness & elasticity: how tight and springy the skin looks, how well it sits on the face, definition along the jawline and lower face, slackness across the cheeks and under the chin

Then write:
- summary: 2-3 supportive sentences describing what you observe overall, using a confident but approachable science-led tone.
- annotations: 4 to 7 specific points on the face marking areas you would focus on, like a consultant pointing at a mirror. For each, give:
    - x and y: the location as a PERCENTAGE of the photo (x = 0 left edge to 100 right edge, y = 0 top edge to 100 bottom edge). Estimate carefully from where the feature actually sits on THIS face. Spread points across the relevant areas; do not stack them.
    - area: the correct aesthetic-medicine term. Use terms from this set where applicable: "Forehead lines", "Glabella / frown lines", "Periorbital lines (crow's feet)", "Tear trough / under-eye", "Cheek hydration & glow", "Nasolabial folds", "Marionette lines", "Perioral (lip) lines", "Skin texture & pores", "Uneven tone / pigmentation", "Visible redness", "Jawline & lower-face skin laxity", "Cheek & mid-face laxity".
      FIRMNESS AND LINES ARE NOT OPTIONAL. If this face shows ANY visible slackness along the jawline or across the cheeks, or any forehead, frown or crow's-feet lines, you MUST flag at least one of them as an annotation. Veluria Ultra Lift is the product that answers them, and skipping them tells the client we have nothing for the concern they are most likely to have come in with.
    - concern: one short phrase on what is visibly observed there.
    - treatment: one short, honest sentence. Two cases:
        * Concern WITHIN the Veluria range: NAME THE MATCHING PRODUCT and say what it can realistically improve there. Pigmentation, uneven tone, sun spots, dullness → Veluria Pearl Tone. Laxity, firmness, jawline definition, forehead lines, frown lines, crow's feet → Veluria Ultra Lift. Texture, pores, hydration, glow, fine surface lines, post-acne marks, irritated-looking redness → Veluria Silk Skin. Example: "A course of Veluria Pearl Tone can visibly soften and even these sun spots and brighten the overall tone." Never guarantee outcomes.
        * Concern genuinely OUTSIDE the range (active acne, visible capillaries/thread veins, deep folds or volume loss, moles or lesions, ice-pick scarring): the sentence MUST start with exactly "Beyond Veluria's scope — " followed by a short note that the clinician can advise at the consultation. Do NOT name any other product or treatment. Example: "Beyond Veluria's scope — the clinician can advise on this at your consultation."
    - severity: "low", "moderate", or "notable".
- veluriaRecommendation: 2-3 sentences setting out THIS person's Veluria plan. Name the specific product(s) their concerns call for and why (e.g. "Pearl Tone to even the sun damage across your cheeks, alongside Silk Skin to refine texture"). Be specific to what you actually observed. If some of their concerns genuinely sit outside the range, acknowledge that honestly in one clause and note the clinician will advise at the consultation. Warm and encouraging, never guaranteeing results. End with a gentle invitation to book a consultation.

Rules:
- If the image is not a usable face photo (no face, too dark, not a person), respond ONLY with: {"error":"no_face"}
- Otherwise respond ONLY with a single valid JSON object, no markdown, no code fences, matching exactly:
{
  "summary": string,
  "categories": [
    {"label":"Hydration","score":number,"note":string},
    {"label":"Fine lines","score":number,"note":string},
    {"label":"Texture & pores","score":number,"note":string},
    {"label":"Tone & redness","score":number,"note":string},
    {"label":"Radiance","score":number,"note":string},
    {"label":"Firmness & elasticity","score":number,"note":string}
  ],
  "annotations": [
    {"x":number,"y":number,"area":string,"concern":string,"treatment":string,"severity":"low"|"moderate"|"notable"}
  ],
  "veluriaRecommendation": string,
  "disclaimer": "This is a cosmetic, non-diagnostic assessment of visible skin appearance only and is not medical advice."
}
Each note must be a single short sentence. Scores must be integers. x and y must be numbers between 0 and 100.`;

export interface ConcernArea {
  area: string;
  concern: string;
}

/**
 * Maps a flagged concern to the change the MATCHED Veluria product delivers there.
 *
 * Veluria is a three-product bioremodeling range, not one hydrating booster, so
 * the answer depends on which product the concern calls for — see lib/veluria.ts.
 * Pigmentation goes to Pearl Tone, laxity to Ultra Lift, everything else in scope
 * to Silk Skin. Concerns genuinely outside the range (active acne, visible
 * vessels, structural volume, moles) are preserved exactly and say so.
 *
 * Every branch returns PRESERVATION *plus* a positive action. An earlier version
 * returned a bare prohibition ("DO NOT fade the pigmentation…") for out-of-scope
 * concerns, so a client whose concerns were all out-of-scope got a prompt with
 * nothing positive in it at all, and gpt-image-2 duly returned the photo unchanged.
 *
 * SOFTENED, NOT ERASED — applied to lines and folds, not just pigment. Expression
 * lines and the under-eye used to be locked absolutely ("reproduce the deeper set
 * expression lines at their original depth"; "reproduce the under-eye darkness and
 * the hollow/bag structure exactly"). Against gpt-image-2's reconstruction bias an
 * absolute lock always wins, so those clients got back a merely dewier photo and
 * did not book. The locks were also wrong on the evidence: DMAE — Ultra Lift's
 * active — has controlled-trial support (Grossman 2005; Uhoda 2002) for visibly
 * softening forehead and periorbital lines and increasing skin firmness, and PDRN
 * thickens thin infraorbital skin so the shadow reads lighter.
 *
 * What is genuinely structural is still locked, and now locked more precisely:
 * VOLUME may never be filled. A fold reads softer because the skin over it is
 * firmer; it is never filled in. A tear trough reads less shadowed because the
 * skin is thicker and less translucent; the socket is never plumped. That is the
 * real line between a bioremodeller and a filler, and it is the line the report,
 * the expectations engine and this prompt all now draw in the same place.
 */
function targetedAfterAction(area: string, concern: string): string {
  const t = `${area} ${concern}`.toLowerCase();

  // Out of the range entirely: reproduce it, and improve the skin around it.
  if (/(active acne|inflammatory acne|cystic|pustule|breakout|pimple|papule|whitehead|blackhead)/.test(t))
    return "reproduce every active breakout and pimple exactly as in the original — Veluria works on the marks acne leaves behind, not on active acne. The skin around and between them becomes visibly clearer, calmer, smoother and more luminous";
  if (/(capillar|thread vein|telangiectas|broken vein|vascular|rosacea)/.test(t))
    return "reproduce every visible capillary and thread vein exactly — same colour, size and position; these are vessels and Veluria does not remove them. The skin they sit in does improve: it reads calmer, less irritated, smoother and healthier";
  if (/(mole|skin tag|beauty spot|freckle)/.test(t))
    return "reproduce every mole, beauty spot and freckle exactly as in the original — these are never treated. The surrounding skin becomes clearer, more even and more radiant";

  // Under-eye is checked BEFORE the structural branch. It used to fall into it on
  // the word "hollow" and come back with "reproduce ... exactly at their original
  // depth", which locked the whole area — the single biggest reason clients said
  // the after image showed nothing. Dark circles have three separable causes and
  // Veluria genuinely answers two of them; only the fat-pad hollow is structural.
  if (/(dark circle|under[ -]?eye|tear trough|periorbital|eye bag|puff|infraorbital)/.test(t))
    return "the under-eye SKIN is rebuilt: visibly thicker, firmer, smoother, plumper and far less crepey, and the fine lines there are clearly shallower. Because the skin is denser and less translucent, THE WHOLE AREA READS BRIGHTER, LESS SHADOWED AND RESTED — the shadow is lighter and softer-edged than in the original, and any brown or bluish pigment stain there is softened and less obvious. But do NOT fill the socket: if there is a true hollow from lost volume under the eye, its shape and depth stay exactly as they are — no filler-style plumping of the tear trough, and no puffiness added";

  if (/(deep fold|deep static|nasolabial|marionette|volume loss|lip shape|jowl fat)/.test(t))
    return "the SKIN over and around the fold is visibly firmer, denser, smoother and better hydrated, so the fold reads a little softer and less harshly etched than in the original — but it is still clearly there. Do NOT fill it, erase it or add filler-style volume: the underlying facial volume and contour are structural and stay exactly as they are";

  // In scope — Pearl Tone: tone, pigment, radiance.
  if (/(pigment|dark spot|sun spot|age spot|melasma|discolou?r|uneven tone|sallow|dull|blotch|\btone\b)/.test(t))
    return "Veluria Pearl Tone (glutathione) works here: the tone becomes visibly clearer, brighter and far more EVEN. Sun spots, age spots and pigment patches are visibly SOFTENED and much less contrasted against the skin around them — they are still present, just far less obvious — and the dull, sallow cast lifts into healthy luminous radiance. This is evening and brightening, NEVER skin-lightening: the real skin tone and ethnicity are unchanged";

  // In scope — Ultra Lift: laxity and firmness.
  if (/(laxity|lax|sag|firm|elastic|jawline|jowl|slack|contour|neck)/.test(t))
    return "Veluria Ultra Lift (DMAE, collagenase) works here, and THIS MUST BE OBVIOUS: the skin is visibly firmer, tighter and springier. It sits HIGHER and cleaner on the face instead of hanging — slack cheek skin is taut again, the soft heaviness along the lower face is gone, and the jaw margin reads as one clean, continuous, well-defined line instead of a soft, interrupted one. The shadow under the jaw and along the lower cheek is shallower because the skin no longer droops into it. This is the SKIN retracting and tightening, nothing else: do NOT reshape or slim the face, do NOT narrow the jaw, do NOT alter the bone structure, and do NOT add filler-style volume anywhere";

  // In scope — Silk Skin: everything else, including post-acne marks.
  if (/(scar|post.?acne|acne mark|mark)/.test(t))
    return "Veluria Silk Skin (PDRN, collagenase) works here: post-acne marks and textural scarring are visibly softened, shallower and much less pronounced — still present, but far less obvious — and the surrounding skin is refined and luminous";
  if (/(line|wrinkle|crease|crow|forehead|glabella|frown|perioral)/.test(t))
    return "Veluria Ultra Lift (DMAE) and Silk Skin work here together, and the change must be clearly visible: these lines are plumped out from beneath and become MARKEDLY SHALLOWER, softer and far less etched into the skin — a crease that cut sharply into the surface now reads as a soft, faint line. They are SOFTENED, NEVER ERASED: every line is still in exactly the same place and the face keeps its natural expression and character. Do not smooth the forehead or the eye area into a blank, flat, waxy plane, and do not remove the person's expression";
  if (/(texture|pore|rough|bumpy|congest|uneven)/.test(t))
    return "Veluria Silk Skin works here: the rough, uneven texture is resurfaced into a smooth, even, refined “glass skin” surface, and enlarged pores read tighter and cleaner — real pore detail and micro-texture stay visible";
  if (/(redness|\bred\b|irritat|reactive|inflam)/.test(t))
    return "the irritated, angry-looking redness reads visibly calmer and less inflamed (PDRN and Centella asiatica soothe it), and the skin there is smoother and better hydrated. Any distinct visible blood vessels are reproduced exactly — those are not treated";
  if (/(hydrat|dry|dehydrat|glow|radian|plump|crepe|tired)/.test(t))
    return "this is where the change is most obvious: dull, dry, tired, dehydrated skin becomes visibly plump, supple and radiant — skin that catches the light with a healthy lit-from-within glow";

  return "the skin here becomes visibly firmer, smoother, clearer and more radiant";
}

/**
 * Builds the gpt-image-2 prompt for the AFTER image.
 *
 * Edits the user's real selfie (the FIRST image) and returns the SAME person,
 * same pose/crop/framing/lighting, with only skin QUALITY improved. The app
 * keeps the untouched selfie as the "before", so the before is never altered.
 *
 * Shape matters as much as content, and both are load-bearing:
 *  - The visible-change demand comes FIRST and is restated LAST. An earlier
 *    version ended on restrictions; the model took the last word as licence to
 *    hold back and returned images barely distinguishable from the input.
 *  - Preservation is stated ONCE, positively ("copy these across exactly"),
 *    not as a wall of DO-NOTs. gpt-image-2 follows positive preservation far
 *    more reliably than negation, and repeating the restrictions three times
 *    suppressed the improvement altogether.
 *
 * Both properties are verified together: the glow must be obvious AND redness,
 * pigmentation, blemishes, scars and deep folds must survive the edit intact.
 */
export function buildAfterImagePrompt(
  concerns: ConcernArea[],
  hasReferences: boolean,
  annotate = false,
): string {
  const list: ConcernArea[] =
    concerns.length > 0
      ? concerns.slice(0, 6)
      : [
          { area: "Cheeks", concern: "dullness and dryness" },
          { area: "Skin texture & pores", concern: "rough texture and visible pores" },
          { area: "Fine surface lines", concern: "early fine lines and crepiness" },
        ];

  const focus = list
    .map((c) => `- ${c.area} (${c.concern}): ${targetedAfterAction(c.area, c.concern)}`)
    .join("\n");

  // When annotate is set, the SAME image also carries the treatment-map
  // pointers, so one generation serves both the slider and the map container.
  const pointerBlock = annotate
    ? `\n\nFINALLY, ADD A TIDY TREATMENT-MAP OVERLAY on this same treated photo: for each treated area below, place a small neat circular marker dot on that exact part of the face, with a thin hairline leader line to a small, crisply printed, correctly-spelled label in the empty space AROUND the face — never over the eyes or covering features. Each label is just the area name. Keep it minimal, elegant and perfectly legible, like a premium Aesthetics Central Clinic treatment diagram in soft gold and charcoal — no clutter, no legend. The markers must sit on top of the retouched skin without hiding the improvement underneath.\nTREATED AREAS TO MARK:\n${list.map((c) => `- ${c.area}`).join("\n")}`
    : "";

  const referenceLine = hasReferences
    ? `\n\nREFERENCE IMAGES: any image AFTER the first shows REAL skin following aesthetic treatment — match that realistic treated-skin texture, tone and glow. Do NOT copy the reference people's identity or features in any way.`
    : "";

  // The plan drives the image: only the products this client actually needs get
  // to change their skin. Someone with no pigment concern must not get Pearl
  // Tone's tone-evening applied to them.
  const plan = planFor(list);
  const planBlock = plan
    .map((p) => `- ${p.name} (${p.actives}) — over ${p.sessions} sessions: ${p.visibleResult}.`)
    .join("\n");

  // The lift bullet is emitted ONLY when this client's plan actually contains
  // Ultra Lift. Same rule as the plan block above: a client with no laxity
  // concern must not be shown a firmness result from a product nobody
  // recommended them. It leads the list because "firmer" is the change the
  // model is most inclined to skip, and the first bullet carries the most weight.
  const liftBlock = plan.some((p) => p.id === "ultra-lift")
    ? `- LIFTED AND FIRM — THIS IS THE HEADLINE CHANGE, AND IT MUST BE OBVIOUS AT A GLANCE. The skin is denser, tighter and springier, and it SITS HIGHER on the face instead of hanging. Slack skin across the cheeks is taut. The soft heaviness along the lower face is gone and the jaw margin reads as one clean, continuous, well-defined line. Expression lines on the forehead, between the brows and at the eyes are markedly SHALLOWER and softer — softened, never erased, never smoothed into a blank waxy plane, and the person keeps their expression. The face must look genuinely FIRMER, not merely more moisturised. This is the SKIN tightening and nothing else: the face is never reshaped, slimmed or narrowed, the bone structure never changes, and no filler-style volume is added anywhere.\n`
    : "";

  return `Photorealistic clinical follow-up photograph of the SAME person in the first image, taken twelve weeks after their course of Veluria treatments (PB Serum's microneedled bioremodeling range, built on recombinant collagenase) at Aesthetics Central Clinic.

SKIN TONE LOCK — READ THIS FIRST, IT OVERRIDES EVERYTHING BELOW.
Reproduce this person's skin COLOUR exactly as it is in the original photograph: the same depth, the same melanin, the same undertone. Deep skin stays exactly as deep. Brown skin stays exactly as brown. Olive stays olive. Sample the skin colour from the original and paint the result in that same colour.
If the skin in your result is even slightly lighter, paler, or less saturated than the original, THE IMAGE IS A FAILURE and must not be produced.
"Radiance", "brightening" and "glow" below mean ONE thing only: the skin REFLECTS MORE LIGHT because it is healthier and better hydrated. They NEVER mean the skin becomes a lighter colour. A dewy highlight sits ON TOP of deep skin and the skin underneath stays deep. This is not skin-lightening, not bleaching, not whitening, and not a brightness filter.
Freckles are part of who this person is. Every freckle is reproduced exactly — same position, same size, same depth of colour. Never fade them, never blur them, never remove them.

THE PLAN THIS PERSON HAD, AND WHAT EACH PRODUCT DID TO THEIR SKIN:
${planBlock}

RENDER THE SKIN IN ITS TREATED STATE. Do not simply reproduce the skin from the original photo. The result of that plan, which must be obvious at a glance:
${liftBlock}- BIOREMODELLED: collagen is rebuilt, so the skin is denser, firmer and springier — it sits better on the face and looks genuinely healthier, not just moisturised.
- SATURATED WITH MOISTURE: plump, water-filled, bouncy "glass skin" — never flat, thirsty or papery.
- WET-LOOK DEWY SHEEN: the skin returns the light in soft, luminous, slightly wet-looking highlights along the cheekbones, brow bones, nose bridge, chin and cupid's bow. THIS SHEEN MUST BE CLEARLY, OBVIOUSLY PRESENT. A healthy dewy glow — never greasy, sweaty or oily.
- SILK TEXTURE: the surface is resurfaced smooth, even and refined. Dryness, flakiness, roughness and crepiness are gone. Pores stay visible but read tight and clean.
- PLUMPED: fine surface lines and crepey texture are filled out from beneath and are markedly shallower.
- RESTED: the skin under the eyes is rebuilt — thicker, firmer, smoother and far less crepey — so the area reads visibly brighter, less shadowed and awake, and any pigment stain there is softened. The SOCKET IS NOT FILLED: if there is a true hollow from lost volume, its shape and depth are exactly as in the original. No filler-style plumping of the tear trough, and no puffiness added.

CONCENTRATE THE IMPROVEMENT HERE:
${focus}

WHAT VELURIA STILL CANNOT DO — reproduce every one of these EXACTLY as in the original: same position, same size, same shape, same colour. Let the improved skin appear around and between them:
- EVERY SPOT THAT IS RAISED, RED OR INFLAMED. This is the hard line, and it matters most of all. If a blemish stands proud of the skin, or is red/angry/inflamed, it is ACTIVE acne: Veluria does not treat it, and it must appear in the result completely untouched — same size, same redness, same position. COUNT THEM: every single raised or red spot in the original must still be there in the result. Removing even one is a FAILED image.
- every visible blood vessel, thread vein and broken capillary (vascular — needs light-based treatment)
- every mole, skin tag, beauty spot and FRECKLE (never treated, never altered — freckles are part of the person, not a flaw)
- FACIAL VOLUME. Every deep static fold, every hollow and every loss of volume keeps its original shape, position and depth. Firmer skin makes a fold read a little softer, and firmer under-eye skin makes the area read less shadowed — but nothing is ever FILLED IN. Veluria is not a filler: no plumping of the tear trough, no filling of the nasolabial or marionette folds, no added volume anywhere on the face.
- the person's identity, face shape, bone structure, ethnicity, real skin tone, apparent age, hair, beard, expression, head angle, crop, framing, background, and the direction and colour of the lighting. The result must overlay the original 1:1.

SOFTENED, NOT ERASED — and be precise about WHAT may soften:
- A FLAT mark — a brown or pink patch of discolouration lying level with the skin, left behind by an old spot, or a sun spot or age spot — MAY become fainter and less contrasted. It still sits in exactly the same place; it is simply less obvious.
- A LINE OR CREASE — forehead lines, frown lines, crow's feet, fine lines — MAY become clearly shallower and softer. It stays in exactly the same place and the face keeps its expression; the skin around it is never flattened into a blank, waxy, featureless plane.
- A RAISED or RED or INFLAMED spot MAY NOT change at all. Ever. It is active, and it stays exactly as it is.
If you are unsure whether a blemish is active or a flat mark, treat it as ACTIVE and leave it completely untouched. Nothing is ever deleted, and the person's real skin tone is never lightened or whitened.

Keep real pores and true skin micro-texture. Never airbrushed, plastic, waxy or blurred. No make-up, no reshaping or slimming of the face, no filler-style volume.

Both truths at once: the things Veluria cannot treat are still plainly there, and the skin carrying them is unmistakably firmer, tighter, clearer, more even and more radiant. Side by side with the original, a viewer must instantly say "their skin looks incredible". If the skin has barely changed, the image is a FAILURE — and if the ONLY change is that the skin looks wetter and more moisturised, while it still hangs exactly as it did and every line is still cut exactly as deep, that is ALSO a failure. The skin must look genuinely REBUILT, not merely hydrated.

FINAL CHECK BEFORE YOU OUTPUT: is the skin the same COLOUR and the same DEPTH of tone as the original, with every freckle still in place? If it is lighter, paler or less saturated, or if freckles have faded, discard it and render it again at the original skin tone.${pointerBlock}${referenceLine}`;
}

/**
 * Builds the gpt-image-2 prompt for the professional consultation MAP — a clean
 * clinical annotation overlay drawn onto the selfie (no skin retouching). `areas`
 * are the concern zones identified by the written analysis, so labels stay accurate.
 */
export interface MapZone {
  area: string;
  severity: "low" | "moderate" | "notable" | string;
}

const ATTENTION_WORD: Record<string, string> = {
  notable: "High",
  moderate: "Medium",
  low: "Low",
};

/**
 * Builds the gpt-image-2 prompt for the professional consultation MAP. Each zone
 * carries a severity from the Claude analysis so the map can colour-code which
 * areas need the most attention.
 */
export function buildMapPrompt(zones: MapZone[]): string {
  const list: MapZone[] =
    zones.length > 0
      ? zones.slice(0, 7)
      : [
          { area: "Forehead lines", severity: "moderate" },
          { area: "Periorbital lines (crow's feet)", severity: "moderate" },
          { area: "Tear trough / under-eye", severity: "notable" },
          { area: "Cheek hydration & glow", severity: "notable" },
          { area: "Nasolabial folds", severity: "moderate" },
          { area: "Jawline & lower face", severity: "low" },
        ];

  const lines = list
    .map((z) => `- ${z.area} — ${ATTENTION_WORD[z.severity] ?? "Medium"} attention`)
    .join("\n");

  return `Turn the FIRST image into a professional aesthetic-clinic CONSULTATION MAP that makes it OBVIOUS AT A GLANCE which areas need the most attention.

Keep the SAME person and photo completely unchanged — do NOT retouch, smooth, beautify or alter the skin, features or background. This is a diagnostic annotation layer placed ON TOP of the original photo.

For each zone below, place a small neat marker dot on that exact facial area, with a thin hairline leader line to a small, crisply printed, clearly legible, correctly-spelled label in the empty space around the face (not over the face). Each label shows the area name and its attention level.

COLOUR-CODE every marker dot and its label by attention level so priority is instantly clear:
- HIGH attention -> red
- MEDIUM attention -> amber / gold
- LOW attention -> green
Add a small, tidy legend in a corner: red = high, amber = medium, green = low attention.

ZONES (area - attention level):
${lines}

Style: Aesthetics Central Clinic — minimal, precise, clean and uncluttered, like a doctor's treatment-planning diagram. Tidy leader lines, labels around the edges, nothing crowding the face. No watermark, no logo.`;
}
