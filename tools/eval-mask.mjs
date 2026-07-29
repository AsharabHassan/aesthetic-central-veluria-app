/**
 * Does gpt-image-2's MASK actually solve the targeted-edit problem?
 *
 * The whole session used `images.edit` with no mask, so every edit was a
 * whole-frame regeneration — which is why the result was either a global beauty
 * filter or, when constrained afterwards in code, no visible change at all.
 *
 * gpt-image-2 ships a mask-based inpainting pipeline: a PNG whose ALPHA=0
 * pixels mark the region to edit and whose ALPHA=255 pixels are preserved. The
 * model still sees the whole photograph for context, but concentrates the edit
 * inside the mask. That is a different mechanism from anything tried here, and
 * it targets exactly the axis that never scored: change the crow's feet
 * properly while leaving the rest of the face alone.
 *
 * Caveat the docs are explicit about: "Masking with GPT Image is entirely
 * prompt-based. The model uses the mask as guidance, but may not follow its
 * exact shape with complete precision." So it is measured here, not assumed.
 *
 *   node tools/eval-mask.mjs [quality]
 */
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const SP = "C:/Users/faisa/AppData/Local/Temp/claude/D--June-Project-Mshah-Application-Aesthetics-Central/e8e4ac21-2cd6-4c53-996c-41eaa5c24c81/scratchpad";
const OUT = `${SP}/eval`;
await mkdir(OUT, { recursive: true });
const SIZE = 1024;

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const FACES = [
  { id: "older", file: "./public/assets/case-studies/facial-rejuvenation-before.webp",
    concerns: "the crow's feet and the crepey under-eye skin; the nasolabial fold; the forehead lines",
    regions: [
      { x: 66, y: 34, rx: 0.17, ry: 0.13 },
      { x: 55, y: 44, rx: 0.16, ry: 0.11 },
      { x: 40, y: 66, rx: 0.14, ry: 0.13 },
      { x: 46, y: 12, rx: 0.22, ry: 0.10 },
    ] },
  { id: "freckles", file: `${SP}/faces/05-freckles.jpg`,
    concerns: "the fine crepey texture under the eye; the enlarged pores across the cheek",
    regions: [
      { x: 42, y: 62, rx: 0.22, ry: 0.18 },
      { x: 55, y: 45, rx: 0.17, ry: 0.12 },
    ] },
  { id: "acne", file: `${SP}/faces/03-acne-teen.jpg`,
    concerns: "the rough uneven texture and the flat post-acne marks across the cheek",
    regions: [
      { x: 22, y: 24, rx: 0.24, ry: 0.18 },
      { x: 20, y: 54, rx: 0.22, ry: 0.18 },
    ] },
];

/**
 * RGBA where the concern regions are TRANSPARENT (edit these) and everything
 * else is OPAQUE (keep). Feathered, so the boundary is a ramp rather than a
 * cut — a hard alpha edge shows up as a seam in the result.
 */
async function buildMask(regions, original) {
  const ell = regions
    .map((r) => `<ellipse cx="${(r.x / 100) * SIZE}" cy="${(r.y / 100) * SIZE}" rx="${r.rx * SIZE}" ry="${r.ry * SIZE}" fill="black"/>`)
    .join("");
  const shape = await sharp(
    Buffer.from(`<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" fill="white"/>${ell}</svg>`),
  ).blur(SIZE * 0.02).greyscale().toColourspace("b-w").removeAlpha().raw().toBuffer();

  /**
   * RGB IS THE ORIGINAL PHOTOGRAPH, not a black canvas.
   *
   * First attempt filled RGB with black and carried the shape in alpha alone.
   * The API composited that black through, and the judge's verdict was "a solid
   * black artifact obscures the eye". OpenAI's own examples build the mask by
   * taking the image and ERASING the parts to change — so the colour channels
   * must still be the picture, with alpha marking the hole.
   */
  const rgb = await sharp(original).resize(SIZE, SIZE, { fit: "cover" }).removeAlpha().raw().toBuffer();
  const rgba = Buffer.alloc(SIZE * SIZE * 4);
  for (let i = 0; i < shape.length; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = shape[i]; // 255 keep, 0 edit
  }
  return sharp(rgba, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer();
}

async function generate(img, mask, prompt, quality) {
  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append("image", new Blob([new Uint8Array(img)], { type: "image/png" }), "face.png");
  if (mask) form.append("mask", new Blob([new Uint8Array(mask)], { type: "image/png" }), "mask.png");
  form.append("prompt", prompt);
  form.append("size", "1024x1024");
  form.append("quality", quality);
  const r = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(290_000),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  return Buffer.from((await r.json()).data[0].b64_json, "base64");
}

const RUBRIC =
  "You are auditing a simulated 'after' photograph for an aesthetics clinic. Image 1 is the client's real " +
  "photograph, image 2 the simulation. Score 1-5, reply ONLY JSON.\n" +
  "visible: 5 = a client would immediately SEE the improvement side by side. 1 = the two look the same; an " +
  "unchanged image scores 1 here, never high.\n" +
  "photographic: 5 = unretouched camera file, individual pores and skin grain visible. 1 = beauty-filter, " +
  "poreless, waxy, blurred.\n" +
  "targeted: 5 = improvement concentrated in the concern areas, rest of face untouched. 1 = whole face " +
  "uniformly smoothed.\n" +
  "identity: 5 = unmistakably the same person and framing. 1 = a different person.\n" +
  "seam: 5 = no visible boundary or patch anywhere. 1 = an obvious rectangle, halo or edge where an area " +
  "was pasted in.\n" +
  "credible: 5 = a dermatologist would accept it as a real 12-week skin-treatment result AND it clearly " +
  "shows one. 1 = either obviously a filter, or shows no result at all.\n" +
  'Reply exactly: {"visible":n,"photographic":n,"targeted":n,"identity":n,"seam":n,"credible":n,"note":"one sentence"}';

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

const quality = process.argv[2] ?? "medium";
const LOCK =
  "Same person, same bone structure, same eye colour, same eyebrows, same hairline, same pose, same " +
  "expression, same camera angle and crop, same lighting, same age.";

console.log(`masked inpainting — quality=${quality}\n`);
console.log("face      vis  photo  targ  ident  seam  cred   note");
console.log("─".repeat(92));

const rows = [];
await Promise.all(FACES.map(async (f) => {
  try {
    const img = await sharp(f.file).resize(SIZE, SIZE, { fit: "cover" }).png().toBuffer();
    const mask = await buildMask(f.regions, img);
    await writeFile(`${OUT}/${f.id}-mask.png`, mask);
    const prompt =
      `Twelve weeks into a course of professional skin treatment, ${f.concerns} are visibly improved — ` +
      `shallower, smoother and healthier. Keep real photographic skin: individual pores, skin grain and ` +
      `natural shine all still visible. Not airbrushed, not blurred, not plastic. ${LOCK}`;
    const after = await generate(img, mask, prompt, quality);
    await writeFile(`${OUT}/${f.id}-MASKED-${quality}.jpg`, await sharp(after).jpeg({ quality: 90 }).toBuffer());
    const s = await judge(img, after);
    rows.push(s);
    console.log(`${f.id.padEnd(9)} ${String(s.visible).padStart(3)}  ${String(s.photographic).padStart(5)}  ${String(s.targeted).padStart(4)}  ${String(s.identity).padStart(5)}  ${String(s.seam).padStart(4)}  ${String(s.credible).padStart(4)}   ${s.note.slice(0, 40)}`);
  } catch (e) { console.log(`${f.id.padEnd(9)} FAILED ${e.message.slice(0, 70)}`); }
}));

if (rows.length) {
  const a = (k) => (rows.reduce((s, x) => s + x[k], 0) / rows.length).toFixed(1);
  console.log(`\nmean      visible ${a("visible")}  photographic ${a("photographic")}  targeted ${a("targeted")}  identity ${a("identity")}  seam ${a("seam")}  credible ${a("credible")}`);
}
