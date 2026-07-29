/**
 * Prompt/quality sweep judged on what the CLIENT cares about, not on MAD.
 *
 * MAD (mean absolute pixel difference) is what this pipeline has been tuned
 * against all session, and it is the wrong objective: a face that has been
 * softly airbrushed all over scores HIGHER than one where only the crow's feet
 * and the under-eye actually changed. Optimising it produced exactly the
 * "Snapchat filter" result the owner rejected.
 *
 * So the judge here scores the axes that decide whether a clinic can use the
 * picture: is it still them, does it still look like a photograph, did the
 * SPECIFIC flagged concerns improve, and does it read as retouching.
 *
 * ADD A `visible` AXIS BEFORE TRUSTING ANY RESULT FROM THIS. The first version
 * of the rubric scored identity/photographic/targeted/credible only, and it
 * handed 5/5/5/5 to an image the judge itself described as "essentially
 * identical, no discernible difference". A rubric made only of things that can
 * be spoiled is maximised by changing nothing — the exact opposite failure of
 * MAD, and just as misleading.
 *
 * WHAT THIS HARNESS FOUND (3 faces, medium and high, 4 prompt shapes):
 *
 *                          visible  photographic  targeted  credible
 *   global improvement       3.3        4.0         3.0       2.3
 *   targeted wording         3.3        3.7         3.0       2.7
 *   confined to regions      2.0        4.7         2.0       2.0
 *
 * Nothing clears 2.7/5 on credibility. Asking for a global improvement gets a
 * beauty filter; constraining it to the flagged regions gets an image the
 * client cannot tell from their own photo. Quality tier did not separate them
 * either — high scored no better than medium on any axis while taking three
 * times as long, because the extra work goes into more smoothing, which is
 * precisely what MAD was rewarding and what the client rejects.
 *
 * The conclusion this points at is about the MODEL, not the prompt: gpt-image-2
 * does global beautification well and localised photographic edits poorly. Any
 * further work here should test a different image model rather than a fifth
 * prompt shape.
 *
 *   node tools/eval.mjs [quality] [variant,variant]
 */
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";
import { writeFile, readFile, mkdir } from "node:fs/promises";

const SP = "C:/Users/faisa/AppData/Local/Temp/claude/D--June-Project-Mshah-Application-Aesthetics-Central/e8e4ac21-2cd6-4c53-996c-41eaa5c24c81/scratchpad";
const OUT = `${SP}/eval`;
await mkdir(OUT, { recursive: true });

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const FACES = [
  { id: "older",   file: "./public/assets/case-studies/facial-rejuvenation-before.webp",
    concerns: "deeply etched crow's feet; crepey under-eye texture; pronounced nasolabial folds; forehead lines" },
  { id: "freckles", file: `${SP}/faces/05-freckles.jpg`,
    concerns: "fine under-eye texture; enlarged pores across the cheek; dullness" },
  { id: "acne",     file: `${SP}/faces/03-acne-teen.jpg`,
    concerns: "rough texture across the cheek; post-acne marks; dullness" },
];

const LOCK =
  "This is the same photograph of the same person: identical face, bone structure, eye colour, " +
  "eyebrow shape and thickness, hairline and hairstyle, clothing, pose, expression, camera angle, " +
  "distance and crop. The head is the same size and in the same position in the frame. Same age.";

const VARIANTS = {
  // What ships today.
  current: (c) =>
    `A photograph of this same person twelve weeks into a course of professional skin treatment.\n\n` +
    `Their skin is the only thing that has changed, and the change is clearly visible:\n` +
    c.split(";").map((s) => `- ${s.trim()} is markedly improved`).join("\n") +
    `\n- the skin overall is even in tone, hydrated and healthy, with a natural light on it\n\n` +
    `${LOCK} Real photographic skin with visible pores and fine detail — a clinical after-photograph, never airbrushed, plastic or blurred.`,

  // Hypothesis: the "filter" look comes from asking for GLOBAL improvement.
  // Change only the named areas; forbid touching anything else.
  targeted: (c) =>
    `The same photograph of the same person, re-taken twelve weeks later after a course of skin treatment.\n\n` +
    `CHANGE ONLY THESE, AND NOTHING ELSE:\n` +
    c.split(";").map((s) => `- ${s.trim()}: visibly improved`).join("\n") +
    `\n\nEverywhere else on the face the skin is IDENTICAL to the original — same texture, same pores, ` +
    `same tone, same marks, same shine. Do not smooth, soften, even out or brighten the face as a whole. ` +
    `This is a targeted change to the areas listed, not an overall improvement.\n\n${LOCK}`,

  // Hypothesis: the fix is photographic framing — documentation, not beauty work.
  documentary: (c) =>
    `A clinical documentation photograph taken at a dermatology follow-up, twelve weeks after treatment. ` +
    `Same subject, same room, same camera and lens, same lighting rig, same distance — a standardised ` +
    `series photograph meant to be compared against the baseline shot.\n\n` +
    `What the follow-up shows: ${c.split(";").map((s) => s.trim()).join(", ")} — each measurably better ` +
    `than at baseline.\n\n` +
    `IT IS AN UNRETOUCHED CAMERA FILE. Skin pores are individually visible across the whole face. Fine ` +
    `vellus hair is visible. Sebum and natural shine are visible where they fall. Skin has grain and ` +
    `micro-texture, not a smooth surface. No beauty retouching of any kind: no skin smoothing, no ` +
    `frequency separation, no soft focus, no glow, no blur, no even-toning. If the skin looks smooth ` +
    `and flawless, the photograph is wrong.\n\n${LOCK}`,

  // targeted's scoping + documentary's anti-retouch framing. The two failure
  // modes are separable — one is "you changed the whole face", the other is
  // "you rendered skin instead of photographing it" — so address both.
  hybrid: (c) =>
    `A standardised clinical follow-up photograph, twelve weeks after a course of skin treatment. Same ` +
    `subject, same camera, same lighting, same distance as the baseline shot, for direct comparison.\n\n` +
    `CHANGED — and only these:\n` +
    c.split(";").map((s) => `- ${s.trim()}: measurably better than at baseline`).join("\n") +
    `\n\nUNCHANGED — everywhere else on the face the skin is identical to the baseline: same pores, same ` +
    `texture, same tone, same marks, same shine, same lines. Do not smooth, soften, brighten or even out ` +
    `the face as a whole. A reader comparing the two photographs should be able to point at exactly which ` +
    `areas were treated.\n\n` +
    `IT IS AN UNRETOUCHED CAMERA FILE, including in the treated areas. Individual pores stay visible ` +
    `there — treated skin is healthier skin, not smoother plastic. Fine vellus hair, skin grain and ` +
    `natural sebum shine are all still present. No beauty retouching of any kind: no skin smoothing, no ` +
    `frequency separation, no soft focus, no glow, no blur. If any part of the face looks poreless or ` +
    `flawless, the photograph is wrong.\n\n${LOCK}`,
};

async function generate(imgBuf, prompt, quality) {
  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append("image", new Blob([new Uint8Array(imgBuf)], { type: "image/png" }), "face.png");
  form.append("prompt", prompt);
  form.append("size", "1024x1024");
  form.append("quality", quality);
  const r = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(290_000),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  return Buffer.from(j.data[0].b64_json, "base64");
}

const RUBRIC =
  "You are auditing a simulated 'after' photograph for an aesthetics clinic. Image 1 is the client's " +
  "real photograph, image 2 the simulation. Score each 1-5 and reply with ONLY JSON.\n" +
  "identity: 5 = unmistakably the same person, same age, same eyebrows, same framing. 1 = a different person.\n" +
  "photographic: 5 = looks like an unretouched camera file — individual pores, skin grain, vellus hair, " +
  "natural shine all visible. 1 = looks like a beauty-filter or smoothing app: poreless, waxy, plastic, blurred.\n" +
  "targeted: 5 = the improvement is concentrated in the specific concern areas and the rest of the face is " +
  "untouched. 1 = the whole face has been uniformly smoothed and brightened.\n" +
  "credible: 5 = a dermatologist would accept this as a real 12-week result from a skin treatment. " +
  "1 = obviously impossible or obviously a filter.\n" +
  'Reply exactly: {"identity":n,"photographic":n,"targeted":n,"credible":n,"note":"one short sentence"}';

async function judge(beforeBuf, afterBuf) {
  const s = (b) => sharp(b).resize(640, 640, { fit: "inside" }).jpeg({ quality: 88 }).toBuffer();
  const [b1, b2] = await Promise.all([s(beforeBuf), s(afterBuf)]);
  const m = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 300,
    thinking: { type: "disabled" },
    system: RUBRIC,
    messages: [{ role: "user", content: [
      { type: "text", text: "Image 1 — real photograph:" },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b1.toString("base64") } },
      { type: "text", text: "Image 2 — simulation:" },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b2.toString("base64") } },
    ]}],
  });
  const t = m.content.find((x) => x.type === "text");
  return JSON.parse(t.text.match(/\{[\s\S]*\}/)[0]);
}

const quality = process.argv[2] ?? "medium";
const variants = (process.argv[3] ?? "current,targeted,documentary").split(",");

const jobs = [];
for (const f of FACES) for (const v of variants) jobs.push({ f, v });

console.log(`quality=${quality}  ${jobs.length} generations\n`);
console.log("face      variant       ident  photo  targ  cred   note");
console.log("─".repeat(96));

const rows = [];
const CONC = 3;
for (let i = 0; i < jobs.length; i += CONC) {
  await Promise.all(jobs.slice(i, i + CONC).map(async ({ f, v }) => {
    const before = await sharp(f.file).resize(1024, 1024, { fit: "cover" }).png().toBuffer();
    try {
      const after = await generate(before, VARIANTS[v](f.concerns), quality);
      await writeFile(`${OUT}/${f.id}-${v}-${quality}.jpg`, await sharp(after).jpeg({ quality: 90 }).toBuffer());
      await writeFile(`${OUT}/${f.id}-before.jpg`, await sharp(before).jpeg({ quality: 90 }).toBuffer());
      const s = await judge(before, after);
      rows.push({ face: f.id, v, ...s });
      console.log(
        `${f.id.padEnd(9)} ${v.padEnd(13)} ${String(s.identity).padStart(4)}  ${String(s.photographic).padStart(5)}  ${String(s.targeted).padStart(4)}  ${String(s.credible).padStart(4)}   ${s.note.slice(0, 44)}`,
      );
    } catch (e) { console.log(`${f.id.padEnd(9)} ${v.padEnd(13)} FAILED ${e.message.slice(0, 60)}`); }
  }));
}

console.log("\nmean by variant:");
for (const v of variants) {
  const r = rows.filter((x) => x.v === v);
  if (!r.length) continue;
  const avg = (k) => (r.reduce((a, x) => a + x[k], 0) / r.length).toFixed(1);
  console.log(`  ${v.padEnd(13)} identity ${avg("identity")}  photographic ${avg("photographic")}  targeted ${avg("targeted")}  credible ${avg("credible")}`);
}
