import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { buildAfterImagePrompt, type ConcernArea } from "@/lib/prompts";
import { getReferenceImages } from "@/lib/references";
import {
  firmnessStrengthFromEnv,
  glowStrengthFromEnv,
  hydrationGrade,
} from "@/lib/glow";
import { programmeFor } from "@/lib/veluria";
import type { HeroFocus } from "@/lib/hero";

export const runtime = "nodejs";
// A medium-quality gpt-image-2 edit measures 55-105s on this prompt; 120s left
// almost no headroom and slow generations were dropping the lead. 300s is the
// Vercel Pro ceiling.
export const maxDuration = 300;

function parseConcerns(input: unknown): ConcernArea[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (c): c is Record<string, unknown> => typeof c === "object" && c !== null,
    )
    .map((c) => ({
      area: typeof c.area === "string" ? c.area.trim() : "",
      concern: typeof c.concern === "string" ? c.concern.trim() : "",
    }))
    .filter((c) => c.area.length > 0)
    // Six, to match buildAfterImagePrompt's own slice. This was 4, so
    // annotations 5 and 6 were silently dropped before the prompt ever saw
    // them — and with the hero now ordered first by the client, truncating
    // early could also have cut the headline area itself.
    .slice(0, 6);
}

/**
 * The headline area, chosen client-side by lib/hero.ts so the report and the
 * image agree on which concern leads. Untrusted input, so it is re-validated
 * here rather than cast.
 */
function parseHero(input: unknown): HeroFocus | null {
  if (typeof input !== "object" || input === null) return null;
  const o = input as Record<string, unknown>;
  const area = typeof o.area === "string" ? o.area.trim() : "";
  if (!area) return null;
  return {
    area,
    concern: typeof o.concern === "string" ? o.concern.trim() : "",
  };
}

/**
 * The six skin-category scores. Untrusted like everything else in the body, so
 * they are re-validated rather than cast: a label that is not one of the six
 * matches nothing in lib/veluria.ts and simply fails to admit a product, and a
 * score outside 0-100 is clamped rather than allowed to widen the programme.
 */
function parseCategories(input: unknown): { label: string; score: number }[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (c): c is Record<string, unknown> => typeof c === "object" && c !== null,
    )
    .map((c) => ({
      label: typeof c.label === "string" ? c.label.trim() : "",
      score:
        typeof c.score === "number" && Number.isFinite(c.score)
          ? Math.max(0, Math.min(100, c.score))
          : 100,
    }))
    .filter((c) => c.label.length > 0)
    .slice(0, 6);
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

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Image generation is not configured." },
      { status: 500 },
    );
  }

  let body: {
    image?: unknown;
    areas?: unknown;
    quality?: unknown;
    annotate?: unknown;
    hero?: unknown;
    categories?: unknown;
  };
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
  const concerns = parseConcerns(body.areas);
  const hero = parseHero(body.hero);
  const categories = parseCategories(body.categories);
  // Quality drives the speed/fidelity trade. The client fires a fast "low"
  // preview and a "medium" refinement (a two-pass, streaming-like reveal).
  // "high" runs a ~3-minute review loop, so it is intentionally not allowed.
  const quality: "low" | "medium" =
    body.quality === "low" ? "low" : "medium";
  // When set, the SAME image also carries the treatment-map pointers, so it can
  // be reused for both the slider and the map container (one generation).
  const annotate = body.annotate === true;

  const client = new OpenAI({ apiKey });

  try {
    const selfie = await toFile(image.buffer, `selfie.${EXT[image.mediaType]}`, {
      type: image.mediaType,
    });

    // Real Veluria "after" skin references (empty array → text-only fallback).
    const references = await getReferenceImages();
    const prompt = buildAfterImagePrompt(
      concerns,
      references.length > 0,
      annotate,
      hero,
      categories,
    );

    const result = await client.images.edit({
      model: "gpt-image-2",
      image: [selfie, ...references],
      prompt,
      // Square so the "after" overlays the square selfie 1:1 in the slider.
      // The two-pass low→medium reveal paints a fast preview first, then
      // sharpens — low is the quickest gpt-image-2 setting (high is ~30-50x
      // slower and runs a review loop).
      size: "1024x1024",
      quality,
      // Deliberately no input_fidelity: gpt-image-2 rejects it outright (400
      // invalid_input_fidelity_model) — it always processes inputs at high
      // fidelity. Measured on this pipeline: medium ~67s, high ~210s for 4x the
      // output tokens and a *weaker* visible improvement, so "high" stays barred.
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json(
        { error: "Image generation returned no result." },
        { status: 502 },
      );
    }

    // Only a client whose PROGRAMME actually contains Ultra Lift gets the lift
    // pass. Same rule the prompt follows: the products this person's skin
    // matched are the only ones allowed to change their image, so someone with
    // no firmness concern is never shown a lift they were not offered.
    const needsLift = programmeFor(categories, concerns).some(
      (p) => p.id === "ultra-lift",
    );

    // The model alone is unreliably subtle on skin that is already in good
    // condition. The grade guarantees the dewy, hydrated result is visible, and
    // being a filter it cannot erase a blemish, pigment patch or scar.
    const graded = await hydrationGrade(
      Buffer.from(b64, "base64"),
      glowStrengthFromEnv(),
      // The client's own photo, so the tone lock can guarantee the treated skin
      // is never lighter than theirs. gpt-image-2 lightens deep skin and the
      // prompt alone does not stop it.
      image.buffer,
      needsLift ? firmnessStrengthFromEnv() : 0,
    );

    return NextResponse.json({
      image: `data:image/jpeg;base64,${graded.toString("base64")}`,
    });
  } catch (err) {
    console.error("[transform] failed:", err);
    return NextResponse.json(
      { error: "We couldn't generate your preview. Please try again." },
      { status: 502 },
    );
  }
}
