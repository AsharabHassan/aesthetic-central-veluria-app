import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { buildZonePrompt } from "@/lib/prompts";
import {
  firmnessStrengthFromEnv,
  glowStrengthFromEnv,
  hydrationGrade,
} from "@/lib/glow";
import { productFor } from "@/lib/veluria";
import { zoneCropBox, zoneWindowFor } from "@/lib/zoneCrop";
import { parseImagePrompt } from "@/lib/promptGuard";

/**
 * Generates the "after" for ONE concern zone, on its own tight crop.
 *
 * See buildZonePrompt in lib/prompts.ts for why this exists: at full frame the
 * model has too few pixels on any one area to do anything but retexture it, so
 * a flagged jawline comes back identical no matter how the prompt is worded.
 * Cropping the zone out and handing it over at a full 1024px is what turns a
 * measured 10.5 into a measured 29.7 on the jaw, and a photo the client cannot
 * tell apart into one they can.
 *
 * Returns BOTH panels. The before crop is cut here rather than in the browser
 * so the two squares are guaranteed to be the same piece of face — the one
 * thing a side-by-side comparison cannot get wrong.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const SIZE = 1024;

/**
 * How much a close-up must visibly change before we are willing to show it.
 *
 * Mean absolute difference between the graded result and this zone's own before
 * crop. CALIBRATED ON THIS EXACT MEASUREMENT, which matters: the first attempt
 * at setting it borrowed anchors from whole-face region MADs on ungraded output
 * — a different scale entirely — and rejected every zone including ones that
 * were plainly good.
 *
 * The measured distribution, one subject, floor disabled, scores paired against
 * looking at the images:
 *
 *   under-eye   11.6, 12.1, 12.4   -> unmistakable. Bag and crepiness clearly
 *                                     reduced, crow's feet softer. SHOW.
 *   forehead    11.2, 12.1         -> unmistakable. Lines markedly shallower. SHOW.
 *   jawline      5.2, 5.7, 6.1, 9.1 -> marginal at best. This is exactly the
 *                                     "it looks the same" the owner reported. DROP.
 *
 * 10 separates them cleanly with a little margin. Note what the jawline column
 * is telling us, because it is the honest headline: a contour change is not
 * something this pipeline can deliver, and the floor's job is to stop us
 * pretending otherwise on a page whose whole purpose is proof.
 *
 * IT IS A LOTTERY, WHICH IS WHY A RETRY IS THE RIGHT SHAPE OF FIX. Identical
 * input and identical prompt produced 5.2 and 9.1 on the same area. A second
 * roll is not wishful thinking, it is the measured distribution.
 */
const MAD_FLOOR = Number(process.env.ZONE_MAD_FLOOR ?? 10);

/**
 * Mean absolute difference between two same-size images, over the whole crop.
 *
 * On a zone crop the whole frame IS the concern area, so a whole-frame measure
 * is already a targeted one — the same reason lib/glow.ts's whole-frame passes
 * are correctly confined here when they were not on a full face.
 */
async function changeScore(after: Buffer, before: Buffer): Promise<number> {
  const norm = (b: Buffer) =>
    sharp(b).resize(512, 512, { fit: "fill" }).greyscale().png().toBuffer();
  const [a, b] = await Promise.all([norm(after), norm(before)]);
  // Materialised to a buffer BEFORE stats(): sharp's .stats() measures its
  // INPUT and silently ignores a pipeline in front of it. That exact bug has
  // already shipped in this repo once — see faceLuminance in lib/glow.ts.
  const diff = await sharp(a)
    .composite([{ input: b, blend: "difference" }])
    .png()
    .toBuffer();
  const stats = await sharp(diff).stats();
  return stats.channels[0].mean;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function parseDataUrl(
  dataUrl: unknown,
): { mediaType: string; buffer: Buffer } | null {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) return null;
  return { mediaType: match[1], buffer: Buffer.from(match[2], "base64") };
}

/**
 * Claude's photographic brief, or null if it cannot be trusted.
 *
 * IT IS MODEL-WRITTEN TEXT THAT DECIDES WHAT A PICTURE SHOWS, so it gets
 * checked rather than passed through. Two failure modes matter:
 *
 *  - STRUCTURE LANGUAGE. Measured on this pipeline, asking an image model for
 *    "rebuilt", "firmer" or "lifted" skin does not merely fail to deliver it —
 *    it drops the visible change from ~23 to ~6, because the model spends the
 *    edit on something it cannot render. A brief that slips into structure is
 *    worse than the template, so it is rejected in favour of it.
 *  - CLAIM DRIFT. Anything asking to remove a mole, erase a scar, or lighten
 *    skin is a claim the clinic cannot make, and it must never reach the API.
 *
 * Rejection is silent and safe: the caller falls back to buildZonePrompt.
 */
/** Untrusted request body → an honest zone, or null. */
function parseZone(
  input: unknown,
): {
  area: string;
  concern: string;
  x: number;
  y: number;
  imagePrompt: string | null;
} | null {
  if (typeof input !== "object" || input === null) return null;
  const o = input as Record<string, unknown>;
  const area = typeof o.area === "string" ? o.area.trim() : "";
  if (!area) return null;
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 50;
  return {
    area,
    concern: typeof o.concern === "string" ? o.concern.trim() : "",
    x: num(o.x),
    y: num(o.y),
    imagePrompt: parseImagePrompt(o.imagePrompt),
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Image generation is not configured." },
      { status: 500 },
    );
  }

  let body: { image?: unknown; zone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const image = parseDataUrl(body.image);
  if (!image) {
    return NextResponse.json(
      { error: "A valid image is required." },
      { status: 400 },
    );
  }
  const zone = parseZone(body.zone);
  if (!zone) {
    return NextResponse.json({ error: "A valid zone is required." }, { status: 400 });
  }

  // The same gatekeeper the report and lib/hero.ts use. An out-of-scope concern
  // must never acquire a generated close-up implying we treated it — the crop
  // is the most persuasive thing on the page, so it is the last place to be
  // loose about scope.
  if (!productFor(zone.area, zone.concern)) {
    return NextResponse.json(
      { error: "This concern is outside the Veluria range." },
      { status: 422 },
    );
  }

  try {
    // Normalise to the same square the browser works in, then cut the identical
    // window ConcernZooms will display.
    const square = await sharp(image.buffer)
      .resize(SIZE, SIZE, { fit: "cover" })
      .png()
      .toBuffer();
    const box = zoneCropBox(
      SIZE,
      zone.x,
      zone.y,
      zoneWindowFor(zone.area, zone.concern),
    );
    const beforeCrop = await sharp(square)
      .extract({ left: box.left, top: box.top, width: box.side, height: box.side })
      .png()
      .toBuffer();

    // Upscaled to a full 1024 — this is the entire point of the route.
    const input = await sharp(beforeCrop)
      .resize(SIZE, SIZE, { fit: "fill" })
      .png()
      .toBuffer();

    const client = new OpenAI({ apiKey });
    // CLAUDE'S BRIEF FIRST, template as the floor.
    //
    // Claude is the only thing in the pipeline that has actually looked at the
    // photograph. A template can say "the texture is smoother"; Claude can say
    // which way the crepe runs under THIS person's eye, what their undertone is
    // and where the light catches — and an image model answers a specific
    // photographic description far better than a generic one. When the brief is
    // missing or fails the claim check, the template still runs.
    const prompt = zone.imagePrompt ?? buildZonePrompt(zone);
    console.log(
      `[zone] "${zone.area}" prompt: ${zone.imagePrompt ? "claude-authored" : "template"}`,
    );
    const needsLift = productFor(zone.area, zone.concern)?.id === "ultra-lift";
    // The tone-lock reference: THIS ZONE's own before crop, not the whole face.
    // The lock guarantees the treated skin is never lighter than the client's
    // own, and on a crop the surrounding face is not there to average it out.
    const reference = await sharp(beforeCrop)
      .resize(SIZE, SIZE, { fit: "fill" })
      .png()
      .toBuffer();

    const attempt = async () => {
      const result = await client.images.edit({
        model: "gpt-image-2",
        image: await toFile(input, `zone.${EXT["image/png"]}`, { type: "image/png" }),
        prompt,
        size: "1024x1024",
        // LOW, deliberately, and it is both faster AND better here.
        //
        // "medium" was chosen when the pipeline took one shot and hoped. Given
        // the same wall-clock budget, three LOW shots fired together beat one
        // medium shot: measured on the under-eye crop, medium scored 25.2 in
        // 67s while best-of-three-low scored 21.7 in 27s — and low holds the
        // original framing noticeably better, where medium drifts the crop.
        // Less than half the latency for the same visible result.
        quality: "low",
      });
      const b64 = result.data?.[0]?.b64_json;
      if (!b64) return null;
      const graded = await hydrationGrade(
        Buffer.from(b64, "base64"),
        glowStrengthFromEnv(),
        reference,
        needsLift ? firmnessStrengthFromEnv() : 0,
      );
      return { graded, score: await changeScore(graded, reference) };
    };

    // BEST OF N, FIRED TOGETHER — not a sequential retry.
    //
    // The output is a lottery: identical input and identical prompt produced
    // 21.7, 17.6 and 10.5 on three runs of the same crop. A sequential retry
    // pays for that spread with latency; firing the candidates in parallel pays
    // for it with money instead, and money is the cheaper of the two here — the
    // client is staring at a loading state, not at an invoice.
    //
    // Wall-clock is therefore ONE low-quality generation (~27s) rather than one
    // medium (~67s) or two mediums in series (~130s), and we keep the best of
    // three instead of the first that happens to clear the bar.
    const CANDIDATES = Number(process.env.ZONE_CANDIDATES ?? 3);
    const shots = await Promise.all(
      Array.from({ length: Math.max(1, CANDIDATES) }, () => attempt()),
    );
    const scored = shots.filter((s): s is NonNullable<typeof s> => s !== null);
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0] ?? null;
    // Logged for every zone, pass or fail: MAD_FLOOR can only be set from the
    // distribution this pipeline actually produces, and the first attempt at
    // setting it used anchors borrowed from a different measurement (whole-face
    // regions, ungraded) which are not on the same scale at all.
    if (best) {
      console.log(
        `[zone] "${zone.area}" kept ${best.score.toFixed(1)} ` +
          `of [${scored.map((s) => s.score.toFixed(1)).join(", ")}]`,
      );
    }

    if (!best) {
      return NextResponse.json(
        { error: "Image generation returned no result." },
        { status: 502 },
      );
    }

    // RATHER NOTHING THAN A DUD. A "before/after" whose after is
    // indistinguishable is worse than no card at all — it teaches the client
    // that every other pair on the page is fake too. The reel drops the slot
    // and shows two strong close-ups instead of three uneven ones.
    if (best.score < MAD_FLOOR) {
      console.warn(
        `[zone] "${zone.area}" below floor across ${scored.length} candidates: ` +
          `${scored.map((s) => s.score.toFixed(1)).join(", ")} < ${MAD_FLOOR}`,
      );
      return NextResponse.json(
        { error: "This close-up did not show a clear enough change." },
        { status: 422 },
      );
    }

    const graded = best.graded;

    return NextResponse.json({
      // WHERE THIS CROP CAME FROM, in the 1024-square coordinate space the
      // browser also normalises to. The full-face "after" is assembled by
      // pasting these close-ups back onto the original photograph — see
      // imaging/compose.py — and that needs the box, not just the picture.
      box: { left: box.left, top: box.top, side: box.side },
      before: `data:image/jpeg;base64,${(
        await sharp(beforeCrop).resize(SIZE, SIZE, { fit: "fill" }).jpeg({ quality: 92 }).toBuffer()
      ).toString("base64")}`,
      after: `data:image/jpeg;base64,${graded.toString("base64")}`,
    });
  } catch (err) {
    console.error("[zone] failed:", err);
    return NextResponse.json(
      { error: "We couldn't generate this close-up." },
      { status: 502 },
    );
  }
}
