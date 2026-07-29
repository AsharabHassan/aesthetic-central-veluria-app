/**
 * FLUX Kontext vs gpt-image-2, same faces, same brief, same six axes.
 *
 * Kontext is built for "change this, keep everything else identical", which is
 * precisely the axis gpt-image-2 never scored on: every configuration tested
 * either beautified the whole face or changed nothing a client could see.
 *
 * Budget-aware: a new BFL account has 200 free credits, about 12 Pro
 * generations, so this defaults to 2 candidates per face across 3 faces.
 *
 *   node tools/eval-kontext.mjs [candidatesPerFace]
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
const N = Number(process.argv[2] ?? 2);

const FACES = [
  { id: "older", file: "./public/assets/case-studies/facial-rejuvenation-before.webp",
    concerns: "deeply etched crow's feet; crepey under-eye texture; pronounced nasolabial folds" },
  { id: "freckles", file: `${SP}/faces/05-freckles.jpg`,
    concerns: "fine under-eye texture; enlarged pores across the cheek; dullness" },
  { id: "acne", file: `${SP}/faces/03-acne-teen.jpg`,
    concerns: "rough uneven texture across the cheek; flat post-acne marks; dullness" },
];

/**
 * Kontext takes an instruction, not a scene description. The gpt-image-2 brief
 * describes the photograph it wants; this tells the model what to DO to the one
 * it has. Same intent, phrased for the model's own idiom.
 */
const PROMPT = (c) =>
  `Reduce ${c.split(";").map((s) => s.trim()).join(", reduce ")}, as if twelve weeks into a course of ` +
  `professional skin treatment. Keep everything else in the photograph exactly as it is: the same person, ` +
  `same face shape, same eyes, same eyebrows, same hairline and hair, same expression, same pose, same ` +
  `crop and framing, same lighting, same background, same age. Keep every mole and freckle. Keep real ` +
  `photographic skin texture with visible pores and skin grain — do not smooth, airbrush or blur the ` +
  `face, and do not change any area that was not listed.`;

async function kontext(imgBuf, prompt) {
  const submit = await fetch("https://api.bfl.ai/v1/flux-kontext-pro", {
    method: "POST",
    headers: { accept: "application/json", "x-key": env.BFL_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      input_image: imgBuf.toString("base64"),
      output_format: "png",
      safety_tolerance: 2,
    }),
  });
  if (!submit.ok) throw new Error(`submit ${submit.status}: ${(await submit.text()).slice(0, 200)}`);
  const { polling_url } = await submit.json();
  if (!polling_url) throw new Error("no polling_url");

  // Poll until Ready. BFL returns Pending while the job runs, and a moderation
  // status rather than an error when it declines the content.
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const p = await fetch(polling_url, { headers: { accept: "application/json", "x-key": env.BFL_API_KEY } });
    if (!p.ok) continue;
    const d = await p.json();
    const st = String(d.status ?? "");
    if (st === "Ready") {
      const url = d.result?.sample;
      if (!url) throw new Error("Ready without a sample url");
      const img = await fetch(url);
      return Buffer.from(await img.arrayBuffer());
    }
    if (st && st !== "Pending" && st !== "Queued" && st !== "Processing") {
      throw new Error(`status ${st}${d.details ? ` ${JSON.stringify(d.details).slice(0, 120)}` : ""}`);
    }
  }
  throw new Error("timed out polling");
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
  "credible: 5 = a clinician would accept it as a real 12-week skin-treatment result AND it clearly shows " +
  "one. 1 = either obviously a filter, or shows no result at all.\n" +
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

const rank = (s) => s.credible * 2 + s.photographic + s.visible + s.targeted + s.identity;

console.log(`FLUX Kontext Pro — best of ${N} per face\n`);
console.log("face      cand  vis  photo  targ  ident  cred   note");
console.log("─".repeat(94));

const bests = [];
for (const f of FACES) {
  const img = await sharp(f.file).resize(1024, 1024, { fit: "cover" }).png().toBuffer();
  await writeFile(`${OUT}/${f.id}-before.jpg`, await sharp(img).jpeg({ quality: 90 }).toBuffer());
  const cands = [];
  for (let i = 0; i < N; i++) {
    try {
      const out = await kontext(img, PROMPT(f.concerns));
      const s = await judge(img, out);
      cands.push({ i, out, s });
      console.log(`${f.id.padEnd(9)} #${i}    ${String(s.visible).padStart(3)}  ${String(s.photographic).padStart(5)}  ${String(s.targeted).padStart(4)}  ${String(s.identity).padStart(5)}  ${String(s.credible).padStart(4)}   ${s.note.slice(0, 38)}`);
    } catch (e) {
      console.log(`${f.id.padEnd(9)} #${i}    FAILED ${e.message.slice(0, 66)}`);
    }
  }
  if (cands.length) {
    cands.sort((a, b) => rank(b.s) - rank(a.s));
    await writeFile(`${OUT}/${f.id}-KONTEXT.jpg`, await sharp(cands[0].out).jpeg({ quality: 92 }).toBuffer());
    bests.push(cands[0].s);
  }
}

if (bests.length) {
  const a = (k) => (bests.reduce((s, x) => s + x[k], 0) / bests.length).toFixed(1);
  console.log(`\nKontext best-of-${N} mean:  visible ${a("visible")}  photographic ${a("photographic")}  targeted ${a("targeted")}  identity ${a("identity")}  credible ${a("credible")}`);
  console.log(`gpt-image-2 best-of-4:     visible 3.0  photographic 4.0  targeted 3.5  identity 5.0  credible 3.0-3.5`);
}
