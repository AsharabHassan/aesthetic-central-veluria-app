import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { buildMapPrompt, type MapZone } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

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

function parseZones(input: unknown): MapZone[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((z) => {
      // Accept either {area, severity} objects or plain strings.
      if (typeof z === "string") return { area: z.trim(), severity: "moderate" };
      if (z && typeof z === "object") {
        const o = z as Record<string, unknown>;
        return {
          area: typeof o.area === "string" ? o.area.trim() : "",
          severity: typeof o.severity === "string" ? o.severity : "moderate",
        };
      }
      return { area: "", severity: "moderate" };
    })
    .filter((z) => z.area.length > 0)
    .slice(0, 7);
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Image generation is not configured." },
      { status: 500 },
    );
  }

  let body: { image?: unknown; areas?: unknown };
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
  const zones = parseZones(body.areas);

  const client = new OpenAI({ apiKey });

  try {
    const selfie = await toFile(image.buffer, `selfie.${EXT[image.mediaType]}`, {
      type: image.mediaType,
    });

    const result = await client.images.edit({
      model: "gpt-image-2",
      image: selfie,
      prompt: buildMapPrompt(zones),
      size: "1024x1024",
      // Low to match the before/after speed so both finish close together.
      quality: "low",
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json(
        { error: "Map generation returned no result." },
        { status: 502 },
      );
    }

    return NextResponse.json({ image: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error("[map] failed:", err);
    return NextResponse.json(
      { error: "We couldn't generate your assessment map. Please try again." },
      { status: 502 },
    );
  }
}
