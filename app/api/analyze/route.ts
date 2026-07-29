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
      // 3000 was right when an annotation was four short fields. It is not now:
      // each annotation also carries `imagePrompt`, a 60-90 word photographic
      // brief, and at 4-7 annotations that is roughly 1500-2500 extra tokens.
      // The response was being truncated mid-object, so the JSON never parsed,
      // both attempts failed, and the client was told "we couldn't analyse that
      // photo" — for a photo that was completely fine.
      //
      // Sized with real headroom rather than to the measured minimum: running
      // out here costs a whole consultation, and unused output tokens cost
      // nothing.
      max_tokens: 8000,
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

    // One retry if the model didn't return clean JSON — and the nudge depends
    // on WHY it failed. Truncation and malformed output need opposite advice:
    // telling a truncated response to "respond with only the JSON object" makes
    // it produce the same too-long reply again, which is exactly how this
    // failed silently twice in a row and cost a real consultation.
    if (!parsed) {
      const truncated = msg.stop_reason === "max_tokens";
      console.warn(
        `[analyze] unparseable reply (stop_reason=${msg.stop_reason}, ${text.length} chars) — retrying ${truncated ? "shorter" : "stricter"}`,
      );
      msg = await callModel(
        truncated
          ? "Your previous reply was cut off before it finished. Send the same JSON object again, but keep every imagePrompt to 50 words or fewer and use at most 5 annotations, so the whole object fits in one reply."
          : "Your previous reply was not valid JSON. Respond with ONLY the JSON object specified, nothing else.",
      );
      text = msg.content.find((b) => b.type === "text")?.text?.trim() ?? "";
      parsed = extractJson(text);
    }

    if (!parsed) {
      console.error(
        `[analyze] gave up after retry (stop_reason=${msg.stop_reason}, ${text.length} chars)`,
      );
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
