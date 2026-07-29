/**
 * BEST-OF-N: the lever this session never pulled on the full-face generation.
 *
 * Every measurement so far treated one generation as the model's answer. It
 * isn't — the output is a lottery. The same prompt, same face, same tier scored
 * anywhere from 2 to 4 on credibility across runs, and this repo already knew
 * that in another context: the old zone pipeline measured 21.7, 17.6 and 10.5
 * on three runs of an identical crop, and fired three candidates because of it.
 *
 * So the honest comparison is not "medium vs high", it is "one medium shot vs
 * four medium shots, judged". Four at medium costs $0.21 — the same as ONE high
 * image, which was already measured as no better than medium.
 *
 *   node tools/eval-bestof.mjs [n] [quality] [variant]
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

const N = Number(process.argv[2] ?? 4);
const QUALITY = process.argv[3] ?? "medium";

const FACES = [
  { id: "older", file: "./public/assets/case-studies/facial-rejuvenation-before.webp",
    concerns: "deeply etched crow's feet; crepey under-eye texture; pronounced nasolabial folds" },
  { id: "freckles", file: `${SP}/faces/05-freckles.jpg`,
    concerns: "fine under-eye texture; enlarged pores across the cheek; dullness" },
];

const LOCK =
  "This is the same photograph of the same person: identical face, bone structure, eye colour, " +
  "eyebrow shape and thickness, hairline and hairstyle, clothing, pose, expression, camera angle, " +
  "distance and crop. The head is the same size and in the same position in the frame. Same age.";

const PROMPT = (c) =>
  `A standardised clinical follow-up photograph, twelve weeks after a course of skin treatment. Same ` +
  `subject, same camera, same lighting, same distance as the baseline shot, for direct comparison.\n\n` +
  `CHANGED — and only these:\n` +
  c.split(";").map((s) => `- ${s.trim()}: measurably better than at baseline`).join("\n") +
  `\n\nUNCHANGED — everywhere else on the face the skin is identical to the baseline: same pores, same ` +
  `texture, same tone, same marks, same shine, same lines. Do not smooth, soften, brighten or even out ` +
  `the face as a whole.\n\n` +
  `IT IS AN UNRETOUCHED CAMERA FILE, including in the treated areas. Individual pores stay visible ` +
  `there — treated skin is healthier skin, not smoother plastic. Fine vellus hair, skin grain and ` +
  `natural sebum shine are all still present. No skin smoothing, no soft focus, no glow, no blur. If ` +
  `any part of the face looks poreless or flawless, the photograph is wrong.\n\n${LOCK}`;

async function generate(img, prompt) {
  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append("image", new Blob([new Uint8Array(img)], { type: "image/png" }), "face.png");
  form.append("prompt", prompt);
  form.append("size", "1024x1024");
  form.append("quality", QUALITY);
  const r = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST", headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form, signal: AbortSignal.timeout(290_000),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 140)}`);
  return Buffer.from((await r.json()).data[0].b64_json, "base64");
}

const RUBRIC =
  "You are auditing a simulated 'after' photograph for an aesthetics clinic. Image 1 is the client's real " +
  "photograph, image 2 the simulation. Score 1-5, reply ONLY JSON.\n" +
  "visible: 5 = a client would immediately SEE the improvement side by side. 1 = they look the same; an " +
  "unchanged image scores 1 here, never high.\n" +
  "photographic: 5 = unretouched camera file, individual pores and skin grain visible. 1 = beauty-filter, " +
  "poreless, waxy, blurred.\n" +
  "targeted: 5 = improvement concentrated in the concern areas, rest of face untouched. 1 = whole face " +
  "uniformly smoothed.\n" +
  "identity: 5 = unmistakably the same person and framing. 1 = a different person.\n" +
  "credible: 5 = a dermatologist would accept it as a real 12-week skin-treatment result AND it clearly " +
  "shows one. 1 = either obviously a filter, or shows no result at all.\n" +
  'Reply exactly: {"visible":n,"photographic":n,"targeted":n,"identity":n,"credible":n,"note":"one sentence"}';

async function judge(a, b) {
  const s = (x) => sharp(x).resize(640, 640, { fit: "inside" }).jpeg({ quality: 88 }).toBuffer();
  const [b1, b2] = await Promise.all([s(a), s(b)]);
  const m = await anthropic.messages.create({
    model: "claude-sonnet-5", max_tokens: 300, thinking: { type: "disabled" }, system: RUBRIC,
    messages: [{ role: "user", content: [
      { type: "text", text: "Image 1 — real photograph:" },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b1.toString("base64") } },
      { type: "text", text: "Image 2 — simulation:" },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b2.toString("base64") } },
    ]}],
  });
  return JSON.parse(m.content.find((x) => x.type === "text").text.match(/\{[\s\S]*\}/)[0]);
}

// Rank on what the clinic needs: a result the client can see, that still looks
// like a photograph of them. `credible` already blends those, so it leads, with
// photographic as the tie-break against a convincing-but-plastic winner.
const score = (s) => s.credible * 2 + s.photographic + s.visible + s.targeted + s.identity;

console.log(`best-of-${N} at ${QUALITY}\n`);
for (const f of FACES) {
  const img = await sharp(f.file).resize(1024, 1024, { fit: "cover" }).png().toBuffer();
  await writeFile(`${OUT}/${f.id}-before.jpg`, await sharp(img).jpeg({ quality: 90 }).toBuffer());
  const cands = await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      try {
        const out = await generate(img, PROMPT(f.concerns));
        const s = await judge(img, out);
        return { i, out, s };
      } catch (e) { console.log(`  ${f.id} #${i} failed: ${e.message.slice(0, 60)}`); return null; }
    }),
  );
  const ok = cands.filter(Boolean).sort((a, b) => score(b.s) - score(a.s));
  console.log(`${f.id}:`);
  for (const c of ok) {
    console.log(`   #${c.i}  vis ${c.s.visible}  photo ${c.s.photographic}  targ ${c.s.targeted}  ident ${c.s.identity}  cred ${c.s.credible}   ${c.s.note.slice(0, 40)}`);
  }
  if (ok.length) {
    await writeFile(`${OUT}/${f.id}-BESTOF-${QUALITY}.jpg`, await sharp(ok[0].out).jpeg({ quality: 92 }).toBuffer());
    const worst = ok[ok.length - 1].s, best = ok[0].s;
    console.log(`   -> best credible ${best.credible} vs worst ${worst.credible}  (spread ${best.credible - worst.credible})\n`);
  }
}
