import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANALYSIS_SYSTEM_PROMPT } from "@/lib/prompts";
import type { SkinAnalysis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5";

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

function parseDataUrl(
  dataUrl: unknown,
): { mediaType: ImageMediaType; data: string } | null {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(
    /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) return null;
  return { mediaType: match[1] as ImageMediaType, data: match[2] };
}

function extractJson(text: string): SkinAnalysis | { error: string } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Analysis is not configured." },
      { status: 500 },
    );
  }

  let body: { image?: unknown };
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

  const client = new Anthropic({ apiKey });

  const callModel = async (nudge?: string) =>
    client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      // Sonnet 5 runs adaptive thinking by default — keep it off for this
      // fast, structured-JSON vision call so responses stay quick and the
      // token budget goes entirely to the analysis.
      thinking: { type: "disabled" },
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mediaType,
                data: image.data,
              },
            },
            {
              type: "text",
              text:
                nudge ??
                "Assess this person's skin and return the JSON exactly as specified.",
            },
          ],
        },
      ],
    });

  try {
    let msg = await callModel();
    let text =
      msg.content.find((b) => b.type === "text")?.text?.trim() ?? "";
    let parsed = extractJson(text);

    // One retry if the model didn't return clean JSON.
    if (!parsed) {
      msg = await callModel(
        "Your previous reply was not valid JSON. Respond with ONLY the JSON object specified, nothing else.",
      );
      text = msg.content.find((b) => b.type === "text")?.text?.trim() ?? "";
      parsed = extractJson(text);
    }

    if (!parsed) {
      return NextResponse.json(
        { error: "We couldn't analyse that photo. Please try another." },
        { status: 422 },
      );
    }

    if ("error" in parsed) {
      return NextResponse.json(
        {
          error:
            "We couldn't detect a clear face. Please upload a well-lit, front-facing photo.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ analysis: parsed });
  } catch (err) {
    console.error("[analyze] failed:", err);
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 502 },
    );
  }
}
