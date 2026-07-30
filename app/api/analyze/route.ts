import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANALYSIS_SYSTEM_PROMPT } from "@/lib/prompts";
import { isExtensivePigmentation } from "@/lib/veluria";
import type { SkinAnalysis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5";
const TRANSIENT_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

function transientStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error))
    return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && TRANSIENT_STATUSES.has(status)
    ? status
    : null;
}

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

/**
 * Enforce the vision model's claim boundary before any downstream consumer can
 * build a product plan or an After prompt from it.
 */
function enforcePreservationScope(analysis: SkinAnalysis): SkinAnalysis {
  const preserve = Array.isArray(analysis.preserve)
    ? analysis.preserve.filter((item): item is string => typeof item === "string")
    : [];
  const additions: string[] = [];
  const annotations = (analysis.annotations ?? []).map((annotation) => {
    const text = `${annotation.area} ${annotation.concern} ${annotation.treatment}`;
    if (!isExtensivePigmentation(text)) return annotation;

    additions.push(
      `the extensive pigmentation pattern across ${annotation.area.toLowerCase()} — preserve its full distribution, boundaries, density, contrast and colour exactly`,
    );
    return {
      ...annotation,
      scope: "preserve" as const,
      concern: (() => {
        const observation = annotation.concern.replace(
          /\bmelasma\b/gi,
          "pigmentation pattern",
        );
        return /^extensive pigmentation pattern — outside veluria scope/i.test(
          observation,
        )
          ? observation
          : `Extensive pigmentation pattern — outside Veluria scope; ${observation}`;
      })(),
      treatment:
        "Beyond Veluria's scope — this extensive pigmentation pattern should be assessed by the clinician and is left unchanged in the preview.",
    };
  });

  for (const annotation of annotations) {
    if (annotation.scope !== "preserve") continue;
    additions.push(
      `${annotation.area}: ${annotation.concern} — leave unchanged in the preview`,
    );
  }

  return {
    ...analysis,
    annotations,
    preserve: [...new Set([...preserve, ...additions])].slice(0, 12),
  };
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

  const callModel = async (nudge?: string) => {
    // Provider overload is transient, but the previous route turned the first
    // 529/5xx into a dead-end consultation. Retry a small bounded number of
    // times; malformed JSON is still handled separately below because that
    // needs a different prompt, not the same request again.
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await client.messages.create({
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
      } catch (error) {
        const status = transientStatus(error);
        if (!status || attempt >= 2) throw error;
        const delay = 900 * 2 ** attempt;
        console.warn(
          `[analyze] Anthropic ${status}; retrying in ${delay}ms (${attempt + 1}/2)`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  };

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

    return NextResponse.json({
      analysis: enforcePreservationScope(parsed),
    });
  } catch (err) {
    console.error("[analyze] failed:", err);
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 502 },
    );
  }
}
