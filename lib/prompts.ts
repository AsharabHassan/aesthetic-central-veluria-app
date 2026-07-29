import { planFor } from "@/lib/veluria";
import type { HeroFocus } from "@/lib/hero";

export const ANALYSIS_SYSTEM_PROMPT = `You are a senior aesthetic skin consultant at Aesthetics Central Clinic, a science-led UK aesthetics clinic specialising in natural results and medically precise treatments. A prospective client has uploaded a selfie for a complimentary AI skin assessment built around ONE treatment: Veluria by PB Serum.

ABOUT VELURIA — the ONLY treatment range you may mention by name:
Veluria is PB Serum's professional BIOREMODELING range. Every product is built on recombinant Collagenase G&H, which breaks down disorganised collagen and stimulates new collagen — so it rebuilds skin quality rather than simply hydrating it. It is delivered by microneedling (or injection) as a course. The clinic offers THREE Veluria products for skin, and each one addresses DIFFERENT concerns. Match the client's concern to the right product:

1. VELURIA SILK SKIN (Collagenase G&H, PDRN, palmitoyl pentapeptide-4, sh-oligopeptide-1, Centella asiatica, hyaluronic acid) — 3-session course. Skin quality and texture:
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

3. VELURIA PEARL TONE (Collagenase G&H, glutathione, hyaluronic acid) — 3-session course, and the vials are double the volume of the other two, so a course covers the neck and décolleté as well as the face. Tone and radiance:
   - uneven skin tone and visible colour differences
   - sun spots, age spots and hyperpigmentation — SOFTENED and evened, never erased
   - post-inflammatory marks left by old breakouts
   - a dull, sallow complexion — brightened into radiance

HOW TO PHRASE IT: always an APPEARANCE claim, never a medical one. Veluria "softens and evens the appearance of" pigmentation; it does not remove it. It "calms irritated-looking redness"; it does not remove blood vessels. It "brightens"; it NEVER lightens or whitens someone's natural skin tone. Never guarantee an outcome.
Prefer the manufacturer's own wording wherever it fits — it is the safest form of every claim we make, and it is already appearance-level: Veluria "refines skin texture", "enhances radiance", "improves the appearance of skin firmness", "boosts luminosity", and "helps reduce the appearance of uneven tone".

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
- annotations: 4 to 6 specific points on the face marking areas you would focus on, like a consultant pointing at a mirror. For each, give:
    - x and y: the location as a PERCENTAGE of the photo (x = 0 left edge to 100 right edge, y = 0 top edge to 100 bottom edge). Estimate carefully from where the feature actually sits on THIS face. Spread points across the relevant areas; do not stack them.
    - area: the correct aesthetic-medicine term. Use terms from this set where applicable: "Forehead lines", "Glabella / frown lines", "Periorbital lines (crow's feet)", "Tear trough / under-eye", "Cheek hydration & glow", "Nasolabial folds", "Marionette lines", "Perioral (lip) lines", "Skin texture & pores", "Uneven tone / pigmentation", "Visible redness", "Jawline & lower-face skin laxity", "Cheek & mid-face laxity".
      FIRMNESS AND LINES ARE NOT OPTIONAL. If this face shows ANY visible slackness along the jawline or across the cheeks, or any forehead, frown or crow's-feet lines, you MUST flag at least one of them as an annotation. Veluria Ultra Lift is the product that answers them, and skipping them tells the client we have nothing for the concern they are most likely to have come in with.
    - concern: one short phrase on what is visibly observed there.
    - treatment: one short, honest sentence. Two cases:
        * Concern WITHIN the Veluria range: NAME THE MATCHING PRODUCT and say what it can realistically improve there. Pigmentation, uneven tone, sun spots, dullness → Veluria Pearl Tone. Laxity, firmness, jawline definition, forehead lines, frown lines, crow's feet → Veluria Ultra Lift. Texture, pores, hydration, glow, fine surface lines, post-acne marks, irritated-looking redness → Veluria Silk Skin. Example: "A course of Veluria Pearl Tone can visibly soften and even these sun spots and brighten the overall tone." Never guarantee outcomes.
        * Concern genuinely OUTSIDE the range (active acne, visible capillaries/thread veins, deep folds or volume loss, moles or lesions, ice-pick scarring): the sentence MUST start with exactly "Beyond Veluria's scope — " followed by a short note that the clinician can advise at the consultation. Do NOT name any other product or treatment. Example: "Beyond Veluria's scope — the clinician can advise on this at your consultation."
    - severity: "low", "moderate", or "notable".
    - imagePrompt: THE PHOTOGRAPHIC BRIEF for this area's simulated "after" close-up. You are writing instructions for an image model that will edit a tight crop of THIS person's own photo, and you are the only one who has actually seen them — so describe what you can see, not what a textbook says.

      WRITE ABOUT THE SURFACE OF THE SKIN AND NOTHING ELSE. This is the single most important rule and it is not about caution, it is about what works. An image model can render texture, tone, line depth, clarity and sheen. It cannot render structure. Asking it for skin that is "rebuilt", "denser", "firmer", "lifted", "plumped from beneath", or for a jaw that "sits higher", measurably makes the result WORSE — it produces a picture where nothing at all has changed. Describe only: how smooth or refined the surface is, how deep the lines are, how even and clear the tone is, how bright or shadowed the area reads, and how the light sits on it.

      Write it as a photographer briefing a retoucher on a real clinical photograph. KEEP IT UNDER 70 WORDS — you are writing several of these in one reply and a long one costs the whole response. Structure it as:
      1. One line naming the shot: a clinical close-up of this person's <area>, twelve weeks into a course of medical microneedling.
      2. Three or four short bullets describing the improved SURFACE, each specific to what you can actually see in this photo — the direction the crepiness runs, where the light catches, the particular shade and undertone of their skin, whether the lines are fine and crosshatched or few and deep.
      3. One closing line locking what must not change: same person, same face, same expression, same head position, same crop, same lighting, same skin colour and depth; every mole, freckle, raised spot and blood vessel exactly where it is; real skin texture, never airbrushed or plastic.

      NEVER write into imagePrompt: anything about volume, filling, lifting, tightening, contour, bone structure, face shape, slimming, or age. Never ask for a spot, mole, freckle, scar or blood vessel to be removed or faded — only FLAT marks may read fainter. Never ask for skin to be made lighter, paler or whiter; "brighter" means it reflects more light, never that the colour changes.

      If this concern is one Veluria cannot treat, set imagePrompt to an empty string "" — an area we do not treat must never acquire a picture implying we did.
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
    {"x":number,"y":number,"area":string,"concern":string,"treatment":string,"severity":"low"|"moderate"|"notable","imagePrompt":string}
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
/**
 * @param allowContour Whether this prompt may ask the FACE OUTLINE to move.
 *
 * It may only when the image stands alone. The full-face pass is displayed
 * inside a before/after slider that assumes the two images overlay 1:1, and
 * `images.edit` re-renders the whole frame rather than editing in place — so
 * asking for the jaw margin to be redrawn is asking the model to move the
 * silhouette, and it takes the background and the head position with it. On a
 * bright, centred face the reconstruction happens to land back on the input; on
 * a dark, off-centre, reclining one it drifts toward an upright centred
 * portrait and the slider halves stop being the same photograph.
 *
 * A zone close-up is overlaid on nothing, so there the contour is free to move
 * — which is exactly where the lift is worth having.
 */
function targetedAfterAction(
  area: string,
  concern: string,
  allowContour = true,
): string {
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
    return allowContour
      ? "Veluria Ultra Lift (DMAE, collagenase) works here, and THIS MUST BE OBVIOUS: the skin is visibly firmer, tighter and springier. It sits HIGHER and cleaner on the face instead of hanging — slack cheek skin is taut again, the soft heaviness along the lower face is gone, and the jaw margin reads as one clean, continuous, well-defined line instead of a soft, interrupted one. The shadow under the jaw and along the lower cheek is shallower because the skin no longer droops into it. This is the SKIN retracting and tightening, nothing else: do NOT reshape or slim the face, do NOT narrow the jaw, do NOT alter the bone structure, and do NOT add filler-style volume anywhere"
      // Same product, same claim, but expressed as skin QUALITY rather than as
      // a redrawn outline — see allowContour above. The crease-depth and
      // surface changes are all still here; what is gone is every instruction
      // to move where the edge of the face sits.
      : "Veluria Ultra Lift (DMAE, collagenase) works here: the skin is visibly firmer, denser, tighter and springier, and it reads taut and well-supported rather than soft and tired. The creases and shadows that slack skin falls into — along the lower cheek and under the jaw — are visibly shallower and less heavy, and the skin surface there is smooth and even. Keep the OUTLINE of the face exactly where it is: the silhouette, jaw edge, chin and neckline stay in precisely the same place, the face is never reshaped, slimmed or narrowed, the bone structure never changes, and no filler-style volume is added";

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
 * Shape matters as much as content, and every structural choice here is
 * load-bearing:
 *
 *  - ONE AREA LEADS. The prompt used to ask for improvement everywhere at once
 *    and got it: a uniform shift across the whole face, which is the hardest
 *    kind of change for a person to see, because the eye compares locally
 *    against a reference and is close to blind to a global one. Clients read
 *    "everything moved a little" as "nothing happened". The hero zone (see
 *    lib/hero.ts) now gets the largest change in the image and is cropped out
 *    at 2x next to the same crop of the original, which is the comparison the
 *    full-face slider never makes.
 *
 *  - IMPROVEMENT OUTWEIGHS RESTRICTION. It did not use to. The prompt carried
 *    four separate preservation sections, a shouted tone lock in the opening
 *    slot and a closing tone check, against six improvement bullets — roughly
 *    70% of the text was telling the model what NOT to do. gpt-image-2 is
 *    already biased toward handing its input back unchanged, so a restriction
 *    majority is a thumb on the scale for "return the photo". Preservation is
 *    now stated ONCE, positively, as a copy-across checklist.
 *
 *  - THE TONE LOCK MOVED, IT DID NOT WEAKEN. It is enforced in code by
 *    lockSkinTone (lib/glow.ts), which is multiplicatively clamped at parity
 *    and structurally incapable of lightening anyone's skin. Repeating it three
 *    times in the prompt bought nothing the code does not already guarantee and
 *    cost the improvement its share of the model's attention. The freckle rule
 *    stays prominent, because that one the code genuinely cannot enforce.
 *
 *  - THE LAST WORD IS THE DEMAND. The prompt ends on "make the change obvious",
 *    never on a constraint. An earlier version closed on the tone check and the
 *    model took the final instruction as licence to hold back.
 *
 * Both properties are verified together: the change must be obvious AND
 * redness, pigmentation, blemishes, scars, vessels and facial volume must
 * survive the edit intact.
 */
export function buildAfterImagePrompt(
  concerns: ConcernArea[],
  hasReferences: boolean,
  annotate = false,
  hero: HeroFocus | null = null,
): string {
  const list: ConcernArea[] =
    concerns.length > 0
      ? concerns.slice(0, 6)
      : [
          { area: "Cheeks", concern: "dullness and dryness" },
          { area: "Skin texture & pores", concern: "rough texture and visible pores" },
          { area: "Fine surface lines", concern: "early fine lines and crepiness" },
        ];

  // The hero gets its own leading section, so it is dropped from the secondary
  // list rather than stated twice — repeating it there would flatten it back
  // into "one of six", which is exactly the levelling this change undoes.
  const secondary = hero
    ? list.filter((c) => !(c.area === hero.area && c.concern === hero.concern))
    : list;

  const heroBlock = hero
    ? `THE ONE CHANGE THAT MATTERS MOST — ${hero.area.toUpperCase()} (${hero.concern}).
This is the headline of the image and the FIRST thing anyone must notice. ${targetedAfterAction(hero.area, hero.concern, false)}.
Make this the LARGEST change in the picture. It has to survive being cropped: if someone cuts a tight square around just this part of the face and holds it beside the same square from the original, the difference must be unmistakable on its own, with no other part of the face visible to help. Everything else on the face improves too, but more quietly, so nothing competes with this.

`
    : "";

  const focus = secondary
    .map((c) => `- ${c.area} (${c.concern}): ${targetedAfterAction(c.area, c.concern, false)}`)
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
  // No silhouette instructions here either — see targetedAfterAction's
  // allowContour. This block used to demand the skin "SITS HIGHER on the face"
  // and the jaw margin be redrawn "as one clean, continuous, well-defined
  // line", which is a request to move the outline of a face that has to overlay
  // the original inside a slider. The firmness claim survives intact; it is now
  // carried by density, crease depth and surface, which the model can deliver
  // without repainting where the face ends.
  const liftBlock = plan.some((p) => p.id === "ultra-lift")
    ? `- FIRM AND REBUILT — THIS IS THE HEADLINE CHANGE, AND IT MUST BE OBVIOUS AT A GLANCE. The skin is denser, tighter and springier, and reads taut and well-supported rather than soft and tired. Slack skin across the cheeks is firm. The creases and shadows that slack skin falls into — along the lower cheek and under the jaw — are visibly shallower and less heavy. Expression lines on the forehead, between the brows and at the eyes are markedly SHALLOWER and softer — softened, never erased, never smoothed into a blank waxy plane, and the person keeps their expression. The face must look genuinely FIRMER, not merely more moisturised. THE OUTLINE OF THE FACE DOES NOT MOVE: the silhouette, jaw edge, chin, neckline and head position stay in exactly the same place, the face is never reshaped, slimmed or narrowed, the bone structure never changes, and no filler-style volume is added anywhere.\n`
    : "";

  return `Photorealistic clinical follow-up photograph of the SAME person in the first image, taken twelve weeks after their course of Veluria treatments (PB Serum's microneedled bioremodeling range, built on recombinant collagenase) at Aesthetics Central Clinic.

THE CAMERA DID NOT MOVE. This is the same person photographed from the identical position on a tripod: same head size in the frame, same head position, same head angle, same crop, same framing, same background in the same place, same lighting direction. Every feature — the eyes, nose, mouth, hairline, the outline of the face and the line of the shoulders — stays at exactly the same pixel coordinates as the original. ONLY THE SKIN CHANGES. This result is shown side by side with the original and the two must overlay each other perfectly; if the head has moved, changed size, or the background has shifted, the photograph has failed no matter how good the skin looks.

${heroBlock}THE PLAN THIS PERSON HAD, AND WHAT EACH PRODUCT DID TO THEIR SKIN:
${planBlock}

RENDER THE SKIN IN ITS TREATED STATE. Do not simply reproduce the skin from the original photo. The result of that plan, which must be obvious at a glance:
${liftBlock}- REBUILT AND PLUMPED: collagen is regenerated, so the skin is denser, firmer and springier — it sits better on the face and looks genuinely healthier rather than merely moisturised. Fine surface lines and crepey texture are filled out from beneath and are markedly shallower.
- SATURATED AND DEWY: plump, water-filled, bouncy "glass skin", and it returns the light in soft, luminous, slightly wet-looking highlights along the cheekbones, brow bones, nose bridge, chin and cupid's bow. THIS SHEEN MUST BE CLEARLY, OBVIOUSLY PRESENT — a healthy dewy glow, never greasy, sweaty or oily, and never flat, thirsty or papery.
- SILK TEXTURE: the surface is resurfaced smooth, even and refined. Dryness, flakiness, roughness and crepiness are gone. Pores stay visible but read tight and clean.
- RESTED: the skin under the eyes is rebuilt — thicker, firmer, smoother and far less crepey — so the area reads visibly brighter, less shadowed and awake, and any pigment stain there is softened. The SOCKET IS NOT FILLED: if there is a true hollow from lost volume, its shape and depth are exactly as in the original. No filler-style plumping of the tear trough, and no puffiness added.

${hero ? "IMPROVE THESE TOO, MORE QUIETLY THAN THE HEADLINE AREA ABOVE:" : "CONCENTRATE THE IMPROVEMENT HERE:"}
${focus}

COPY THESE ACROSS EXACTLY FROM THE ORIGINAL — same position, same size, same shape, same colour — and let the improved skin appear around and between them:
- EVERY SPOT THAT IS RAISED, RED OR INFLAMED. This is the hard line and it matters most of all. A blemish that stands proud of the skin, or is red, angry or inflamed, is ACTIVE acne: Veluria works on the flat marks acne leaves behind, not on active acne. COUNT THEM — every single raised or red spot in the original is still there in the result, same size, same redness, same position. Removing even one is a FAILED image. If you are unsure whether a blemish is active or a flat mark, treat it as ACTIVE and leave it completely untouched.
- Every visible blood vessel, thread vein and broken capillary — vascular, and Veluria does not remove them.
- Every mole, skin tag, beauty spot and FRECKLE. Freckles are part of who this person is, not a flaw: same position, same size, same depth of colour, never faded, never blurred, never removed.
- FACIAL VOLUME. Every deep static fold, every hollow and every loss of volume keeps its original shape, position and depth. Firmer skin makes a fold read a little softer and firmer under-eye skin makes the area read less shadowed — but nothing is ever FILLED IN. Veluria is not a filler: no plumping of the tear trough, no filling of the nasolabial or marionette folds, no added volume anywhere.
- The person's identity, face shape, bone structure, ethnicity, apparent age, hair, beard, expression, head angle, crop, framing, background, and the direction and colour of the lighting. The result must overlay the original 1:1.
- THEIR SKIN COLOUR. Sample it from the original and paint the result in that same colour: same depth, same melanin, same undertone. Deep skin stays exactly as deep, brown stays brown, olive stays olive. "Radiance", "brightening" and "glow" above mean ONE thing — the skin REFLECTS MORE LIGHT because it is healthier and better hydrated. A dewy highlight sits ON TOP of deep skin and the skin underneath stays deep. This is never lightening, bleaching, whitening or a brightness filter.
- Real pores and true skin micro-texture. Never airbrushed, plastic, waxy or blurred. No make-up, no reshaping or slimming of the face.

WHAT MAY CHANGE, precisely: a FLAT mark lying level with the skin — an old post-acne mark, a sun spot, an age spot — may become fainter and less contrasted, still in exactly the same place, simply less obvious. A LINE OR CREASE may become clearly shallower and softer, still in exactly the same place, with the face keeping its expression and the skin around it never flattened into a blank waxy plane. A RAISED, RED or INFLAMED spot may not change at all, ever.

Both truths at once: the things Veluria cannot treat are still plainly there, and the skin carrying them is unmistakably firmer, tighter, clearer, more even and more radiant. Side by side with the original — and especially in a tight crop of the headline area — a viewer must instantly say "their skin looks incredible". If the skin has barely changed, the image is a FAILURE. If the ONLY change is that the skin looks wetter and more moisturised, while it still hangs exactly as it did and every line is still cut exactly as deep, that is ALSO a failure. The skin must look genuinely REBUILT, not merely hydrated.${pointerBlock}${referenceLine}`;
}

/**
 * Builds the prompt for ONE concern zone, generated on its own tight crop.
 *
 * WHY THIS EXISTS, and it is the most load-bearing finding in this file.
 * `images.edit` re-renders the whole frame at 1024x1024. On a normally framed
 * selfie the lower face is a few hundred pixels of that, and at those pixel
 * counts gpt-image-2 treats a region as TEXTURE: it resurfaces and relights
 * skin, and it never rebuilds a contour. Measured on one subject, Ultra Lift in
 * the plan and laxity as the hero, the jaw region moved a mean absolute 11.1
 * (low), 11.5 (medium) and 10.5 (short prompt) — and the jaw margin came back
 * visually identical in all three. The same subject's lower face, cropped out
 * and handed to the model at a full 1024px, moved 29.7 and came back genuinely
 * lifted. The variable that mattered was never the wording. It was how many
 * pixels the region got.
 *
 * So each flagged zone is generated on its own crop, at the same window
 * ConcernZooms displays, and shown as a standalone close-up pair.
 *
 * IT IS NOT COMPOSITED BACK, and that is a hard limit rather than a shortcut.
 * A lift moves the jaw silhouette, so blending it into the full-face image
 * means blending across the face/background boundary — and the zone generation
 * also repaints whatever background and clothing fall inside its crop. Tried:
 * per-channel tone matching plus a 60px feathered mask still landed as a
 * visible rectangle, because the patch's grey background met the base's black
 * top. The full-face pass therefore stays the slider's image, and the zone
 * crops carry the per-area proof.
 *
 * The prompt is short on the same evidence as buildAfterImagePrompt: the long
 * form's restriction mass makes the outcome swing about 2x run to run on
 * identical input. Preservation is stated once, and the last word is the demand.
 */
/**
 * What the treated SURFACE looks like in this area.
 *
 * SKIN ONLY, and that restriction is the whole finding. The previous version of
 * this reused `targetedAfterAction`, which describes the treatment properly for
 * the written report — "rebuilt", "denser", "firmer", "plumped out from
 * beneath", "the socket is not filled". All accurate, and all STRUCTURE, which
 * is the one thing an image-edit model cannot render. Asking for it did not
 * merely fail; it poisoned the whole request.
 *
 * Measured on the same under-eye crop, change score against the client's own
 * photo:
 *
 *     current prompt  (structure + skin), medium   ->  5.9
 *     skin-only prompt,                   medium   -> 25.2
 *
 * Four times the visible change, from deleting the part the model was never
 * going to deliver. That is also why every close-up had stopped rendering: at
 * 5.9 they were all falling under the visible-change floor and being dropped.
 *
 * The claims do not widen. Every line below is a SURFACE claim — smoother, more
 * even, shallower, clearer, dewier — which is exactly the appearance-level
 * wording the manufacturer uses and the only kind a filter-like edit can honour.
 * Structure still gets described honestly in the written report, where words can
 * do what pixels cannot.
 */
function skinAction(area: string, concern: string): string {
  const t = `${area} ${concern}`.toLowerCase();

  if (/(dark circle|under[ -]?eye|tear trough|periorbital|infraorbital|eye bag)/.test(t))
    return `- the crepey, finely-crosshatched texture under her eyes is gone, replaced by smooth, even skin
- the fine lines there are much shallower and softer, still in the same places
- the area reads brighter, clearer and less shadowed`;

  if (/(line|wrinkle|crease|crow|forehead|glabella|frown|perioral)/.test(t))
    return `- the lines here are markedly shallower and softer, each one still in exactly the same place
- the skin between them is smooth, even and firm-looking
- she keeps her natural expression — nothing is flattened into a blank plane`;

  if (/(pigment|dark spot|sun spot|age spot|discolou?r|uneven tone|sallow|blotch|tone)/.test(t))
    return `- the tone is clearly more even and the complexion reads clear and luminous
- discrete sun spots and pigment patches are softer and much less contrasted against the skin around them — still present, just far less obvious
- her actual skin colour and depth are completely unchanged; freckles are untouched`;

  if (/(texture|pore|rough|bumpy|congest|uneven)/.test(t))
    return `- the surface is resurfaced smooth, even and refined, with the roughness gone
- pores are visible but tight and clean
- the skin looks like healthy skin, never airbrushed or plastic`;

  if (/(redness|red|irritat|reactive|inflam)/.test(t))
    return `- the angry, irritated-looking redness reads calmer and much less inflamed
- the skin there is smoother and better hydrated
- any distinct visible blood vessels are exactly as they were`;

  if (/(scar|post.?acne|acne mark|mark)/.test(t))
    return `- the flat marks left behind by old breakouts are softer and much less contrasted — still there, just far less obvious
- the surrounding skin is smooth, even and clear`;

  return `- the surface is smooth, even and refined
- the skin is plump and well-hydrated, with a healthy dewy sheen where the light falls
- the tone is even and the area reads clear and bright`;
}

/**
 * The close-up prompt.
 *
 * SHORT, POSITIVE, AND ABOUT THE SURFACE. Long restriction-heavy prompts made
 * the outcome swing about 2x run to run on identical input; this one states the
 * preservation once and spends the rest of its length on what the skin looks
 * like. It reads like a photographer's brief rather than a legal document,
 * which is the register the model actually responds to.
 */
export function buildZonePrompt(zone: ConcernArea): string {
  return `Professional clinical skin photograph, close-up of the same woman's ${zone.area.toLowerCase()}, twelve weeks into a course of medical microneedling.

Her SKIN QUALITY has visibly improved and this must be obvious:
${skinAction(zone.area, zone.concern)}
- the skin is plump and well-hydrated, with a healthy dewy sheen where the light falls

Same woman, same face, same expression, same head position, same crop, same lighting, same skin colour and depth. Keep every mole, freckle, spot and blood vessel exactly where it is. Real skin texture — never airbrushed, plastic or blurred. Photographic and unretouched-looking, shot on a clinical camera.`;
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
