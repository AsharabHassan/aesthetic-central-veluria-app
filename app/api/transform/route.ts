import { NextResponse } from "next/server";

import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";
import { buildAfterImagePrompt } from "@/lib/prompts";
import { inspectAfterBrief } from "@/lib/promptGuard";
import { hydrationGrade, glowStrengthFromEnv, firmnessStrengthFromEnv } from "@/lib/glow";
import type { ConcernArea } from "@/lib/prompts";
import type { HeroFocus } from "@/lib/hero";
import { planFor } from "@/lib/veluria";
import { zoneWindowFor } from "@/lib/zoneCrop";

/**
 * THE "AFTER" PHOTOGRAPH. One localised edit, constrained by a feathered mask
 * built from the treatable concern coordinates.
 *
 * WHY THIS SHAPE, AND WHY THE PREVIOUS ONE WAS ABANDONED FOR THE WRONG REASON.
 * This route existed once, was judged not to work, and was replaced by a
 * pipeline that generated 2-3 tight zone crops and composited them back onto
 * the client's photo. That pipeline worked exactly as designed and still failed
 * the client, because a zone is ~15% of the frame: a strong zone edit scoring 16
 * to 23 produced a whole-face change of about 2, and clients said — correctly —
 * that their face looked the same.
 *
 * The original verdict was measured on runs at quality "low"/"medium" using a
 * thousand-word prompt that was overwhelmingly prohibition, with the demand for
 * change buried mid-way. Re-measured on the same face, same model, same
 * endpoint, changing only the prompt shape and the quality:
 *
 *   locked prompt, low/medium    jaw moved ~11, "looked identical"
 *   result-first prompt, HIGH    MAD 19.8 across the whole face, identity held
 *   result-first prompt, medium  MAD 15.6, but eyebrows and framing drifted
 *
 * IT WENT TO MEDIUM FOR THE WAIT, AND CAME BACK. Medium fixed the ~200s wait
 * and did hold identity once the closing lock named the parts that actually
 * drift — eyebrow shape and thickness, hairline, camera distance and crop, head
 * size and position in the frame. But the owner reported the before and after
 * had stopped looking different, and he was right. Same photograph, same
 * prompts, same day, only the tier changing:
 *
 *              no preserve clause    with preserve clause
 *   medium      MAD 11.3  (57s)       MAD 15.5  (64s)
 *   high        MAD 24.9 (193s)       MAD 19.4 (181s)
 *
 * Medium does roughly half the work. The preserve clause was the first suspect
 * — it ends the prompt on prohibitions, which is exactly the shape that
 * produced no change in this repo's history — and it was measured and cleared:
 * it does not suppress the result.
 *
 * Turning up the deterministic grade to compensate was also measured and also
 * failed, in the wrong direction: see the note at the hydrationGrade call.
 *
 * So the tier IS the difference, and there is no free version of it. High, and
 * the wait is honest — the loader tells the client it takes around three
 * minutes, and the analysis now runs while they fill in the form.
 *
 * Set AFTER_QUALITY=medium to trade the difference back for ~130 seconds.
 *
 * THE GATE IS INVERTED, AND THAT IS THE POINT. The old pipeline's floor
 * rejected images that changed TOO LITTLE, which is the failure mode of an
 * over-constrained prompt. Once the prompt actually asks for a result, the risk
 * flips: the model may change the PERSON. So the check is now identity, run by
 * the only thing that can actually judge it — a vision model looking at both
 * frames. A pixel metric cannot tell "her lines are softer" from "her eyebrows
 * are different".
 */

export const runtime = "nodejs";
// A high-quality 1024² edit measured 198s. The ceiling is the model, not us.
export const maxDuration = 300;

const SIZE = 1024;
const QUALITY = (process.env.AFTER_QUALITY as "low" | "medium" | "high") ?? "medium";
/**
 * How many candidates to generate and judge.
 *
 * Two medium candidates run in parallel. The first one that clears every
 * clinical and photographic gate is published immediately and the slower call
 * is cancelled, so a good result is never held hostage by a provider outlier.
 */
const CANDIDATES = Number(process.env.AFTER_CANDIDATES ?? 2);
/** One expensive retry is cheaper than publishing an invisible result. */
const RESCUE_QUALITY = (
  process.env.AFTER_RESCUE_QUALITY as "low" | "medium" | "high"
) ?? "medium";
const VERIFY_MODEL = "claude-sonnet-5";
/**
 * The request must finish before the platform's 300 second route ceiling.
 * Previously every upstream call had its own 290 second timeout, so four
 * candidates, verification and a sequential rescue could keep the browser on
 * "Final pass" indefinitely. This is one budget shared by the entire pipeline.
 */
const REQUEST_BUDGET_MS = Math.min(
  240_000,
  Math.max(150_000, Number(process.env.AFTER_MAX_WAIT_MS ?? 220_000)),
);
const VERIFY_CALL_TIMEOUT_MS = 40_000;
/**
 * How many progressive renders to stream before the final image.
 *
 * Each costs 100 image output tokens — pennies against a $0.21 generation, and
 * the difference between a blank spinner and watching the result appear. Must
 * be at least 1; see the streaming note in POST.
 */
const PARTIALS = Number(process.env.AFTER_PARTIAL_IMAGES ?? 3);
const TRANSIENT_ANTHROPIC = new Set([
  408, 409, 429, 500, 502, 503, 504, 529,
]);

function transientAnthropicStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error))
    return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && TRANSIENT_ANTHROPIC.has(status)
    ? status
    : null;
}

interface Assessment {
  /** Would a client SEE the difference side by side? */
  visible: number;
  /** Does it still read as a photograph rather than a beauty filter? */
  photographic: number;
  /** Is the change in the flagged areas, or smeared over the whole face? */
  targeted: number;
  /** Would a clinician accept it as a real 12-week result? */
  credible: number;
  samePerson: boolean;
  /** Did the untreatable features survive? null when there were none. */
  preserved: boolean | null;
  note: string;
}

/**
 * Judge one candidate on the axes that decide whether a clinic can use it.
 *
 * THIS REPLACED A PIXEL METRIC, and the replacement is the most consequential
 * change in this file. The pipeline was tuned for a long time against mean
 * absolute pixel difference, which actively rewards the failure the owner
 * rejected: a face softly airbrushed all over scores HIGHER than one where only
 * the crow's feet and under-eye actually changed. Optimising it produced, in his
 * words, "me with a Snapchat filter".
 *
 * `visible` is not optional. An earlier version of this rubric scored only
 * things that can be spoiled — identity, realism, restraint — and duly awarded
 * 5/5/5/5 to an image it described itself as "essentially identical, no
 * discernible difference". A rubric made only of prohibitions is maximised by
 * changing nothing, which is the same mistake as MAD with the sign flipped.
 *
 * Fails open: a verifier that is down must not cost the client the result they
 * waited for. An unjudged candidate simply ranks below judged ones.
 */
async function assess(
  before: Buffer,
  after: Buffer,
  preserve: string[],
  concerns: ConcernArea[],
  sessions: number,
  deadlineAt: number,
): Promise<Assessment | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const client = new Anthropic({ apiKey: key });
    const shrink = (b: Buffer) =>
      sharp(b).resize(640, 640, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
    const [b1, b2] = await Promise.all([shrink(before), shrink(after)]);

    const request = {
      model: VERIFY_MODEL,
      max_tokens: 300,
      thinking: { type: "disabled" } as const,
      system:
        "You are auditing a simulated 'after' photograph for an aesthetics clinic. Image 1 is the " +
        `client's real photograph, image 2 a completed ${sessions}-session Veluria-course simulation. ` +
        "Score 1-5 and reply with ONLY JSON.\n" +
        "The intended treatable concerns are: " +
        concerns.filter((c) => c.scope !== "preserve").slice(0, 6).map((c) => `${c.area}: ${c.concern}`).join("; ") +
        ".\n" +
        "Any concern marked for preservation is excluded from the treatment result. Do not lower visible or credible because an excluded feature correctly remains unchanged; score improvement only in the treatable concerns listed above.\n" +
        "visible: 5 = a client would immediately SEE the improvement side by side. 1 = the two look " +
        "the same; an unchanged image scores 1 here, never high.\n" +
        "photographic: 5 = an unretouched camera file with individual pores and skin grain visible. " +
        "1 = a beauty filter: poreless, waxy, plastic, blurred.\n" +
        "targeted: 5 = the improvement sits in the concern areas and the rest of the face is " +
        "untouched. 1 = the whole face has been uniformly smoothed.\n" +
        `credible: 5 = a clinician would accept it as a real completed ${sessions}-session skin-treatment result AND it ` +
        "clearly shows one. 1 = either obviously a filter, or shows no result at all.\n" +
        "samePerson: true only if it is unmistakably the same individual — same bone structure, eye " +
        "shape and colour, eyebrows, hairline, apparent age, skin tone and depth, pose and framing. " +
        "Softer lines and clearer skin are expected and must NOT count against it; changed eyebrows, " +
        "a reshaped nose or jaw, a different apparent age or a lightened skin tone must.\n" +
        "preserved: all pre-existing moles, freckles, birthmarks, skin tags, lesions, wounds, active or inflamed spots, " +
        "crusted/scaly/rash-like areas, visible vessels and other condition-like features must remain unchanged in size, " +
        "shape, colour, texture, number and position. " +
        (preserve.length
          ? "Also verify every specifically listed feature: " + preserve.map((p) => `"${p}"`).join("; ") + ". "
          : "") +
        "If any such feature was healed, removed, faded or cosmetically improved, preserved is false.\n" +
        'Reply exactly: {"visible":n,"photographic":n,"targeted":n,"credible":n,"samePerson":bool,' +
        '"preserved":bool,' +
        '"note":"one short sentence"}',
      messages: [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "Image 1 — the client's own photograph:" },
            { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: b1.toString("base64") } },
            { type: "text" as const, text: "Image 2 — the simulation:" },
            { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: b2.toString("base64") } },
          ],
        },
      ],
    };
    let msg: Awaited<ReturnType<typeof client.messages.create>> | null = null;
    for (let attempt = 0; ; attempt += 1) {
      try {
        const remaining = deadlineAt - Date.now();
        if (remaining < 1_500) return null;
        msg = await client.messages.create(request, {
          // The SDK retries by default. Keep retries in this deadline-aware
          // loop so an overloaded verifier cannot silently multiply the wait.
          maxRetries: 0,
          timeout: Math.min(VERIFY_CALL_TIMEOUT_MS, remaining - 500),
        });
        break;
      } catch (error) {
        const status = transientAnthropicStatus(error);
        if (!status || attempt >= 2 || deadlineAt - Date.now() < 2_500)
          throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, 750 * 2 ** attempt),
        );
      }
    }
    if (!msg) return null;

    const text = msg.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const match = text.text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const p = JSON.parse(match[0]);
    const n = (v: unknown) => (typeof v === "number" && v >= 1 && v <= 5 ? v : 1);
    return {
      visible: n(p.visible),
      photographic: n(p.photographic),
      targeted: n(p.targeted),
      credible: n(p.credible),
      samePerson: p.samePerson === true,
      preserved: p.preserved === true,
      note: typeof p.note === "string" ? p.note : "",
    };
  } catch (err) {
    console.warn("[transform] assessment unavailable:", err);
    return null;
  }
}

function parseDataUrl(v: unknown): Buffer | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  return m ? Buffer.from(m[1], "base64") : null;
}

/** Untrusted `preserve` entries → short, safe phrases. */
function parsePreserve(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && s.length <= 200)
    .slice(0, 12);
}

function parseConcerns(v: unknown): ConcernArea[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c): ConcernArea => ({
      area: typeof c.area === "string" ? c.area.trim() : "",
      concern: typeof c.concern === "string" ? c.concern.trim() : "",
      scope:
        c.scope === "preserve"
          ? ("preserve" as const)
          : c.scope === "veluria"
            ? ("veluria" as const)
            : undefined,
      x:
        typeof c.x === "number" && Number.isFinite(c.x)
          ? Math.max(0, Math.min(100, c.x))
          : undefined,
      y:
        typeof c.y === "number" && Number.isFinite(c.y)
          ? Math.max(0, Math.min(100, c.y))
          : undefined,
      severity:
        c.severity === "notable" || c.severity === "moderate" || c.severity === "low"
          ? c.severity
          : undefined,
    }))
    .filter((c) => c.area.length > 0);
}

interface EditMasks {
  /** White where the generated result may replace the original photograph. */
  coverage: Buffer;
}

/**
 * Build a feathered treatment-zone mask from the coordinates placed on the
 * client's face by the vision analysis. This is a hard identity boundary: the
 * model is not allowed to repaint the entire photograph, and the same mask is
 * applied again after grading so every pixel outside the indicated skin zones
 * comes from the original upload.
 */
async function buildEditMasks(concerns: ConcernArea[]): Promise<EditMasks | null> {
  const editable = concerns
    .filter(
      (concern) =>
        concern.scope !== "preserve" &&
        typeof concern.x === "number" &&
        typeof concern.y === "number",
    )
    .slice(0, 6);
  if (!editable.length) return null;

  const protectedAreas = concerns
    .filter(
      (concern) =>
        concern.scope === "preserve" &&
        typeof concern.x === "number" &&
        typeof concern.y === "number",
    )
    .slice(0, 8);

  const ellipses = editable
    .map((concern) => {
      const window = zoneWindowFor(concern.area, concern.concern);
      const text = `${concern.area} ${concern.concern}`.toLowerCase();
      const jaw = /(jaw|jowl|lax|sag|lower.face|neck|chin|firm|elastic)/.test(text);
      const folds = /(nasolabial|marionette|perioral|smile line|mouth)/.test(text);
      const width = SIZE * window * (jaw ? 0.94 : folds ? 0.7 : 0.72);
      const height = SIZE * window * (jaw ? 0.48 : folds ? 0.78 : 0.64);
      const cx = (concern.x! / 100) * SIZE;
      const cy = (concern.y! / 100) * SIZE;
      return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(
        width / 2
      ).toFixed(1)}" ry="${(height / 2).toFixed(1)}" fill="white"/>`;
    })
    .join("");

  // A treatable line or texture zone can overlap pigmentation, a mole or
  // another excluded feature. The API mask and the final local composite both
  // use this same coverage image, so punching protected regions out here is a
  // pixel-level guarantee: those areas are restored from the original upload
  // even if the image model tries to improve them.
  const protectedEllipses = protectedAreas
    .map((concern) => {
      const text = `${concern.area} ${concern.concern}`.toLowerCase();
      const pigmentation = /(pigment|melasma|discolou?r|brown patch|uneven tone)/.test(text);
      const conditionLike =
        /(lesion|mole|skin tag|birthmark|wound|ulcer|crust|scal(?:e|y|ing)|rash|infection|blister|weeping|bleeding)/.test(text);
      const forehead = pigmentation && /forehead/.test(text);
      const cheek = pigmentation && /cheek/.test(text);
      const rx = SIZE * (forehead ? 0.34 : cheek ? 0.27 : pigmentation ? 0.3 : conditionLike ? 0.22 : 0.16);
      const ry = SIZE * (forehead ? 0.15 : cheek ? 0.13 : pigmentation ? 0.17 : conditionLike ? 0.18 : 0.13);
      const cx = (concern.x! / 100) * SIZE;
      const cy = (concern.y! / 100) * SIZE;
      return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="black"/>`;
    })
    .join("");

  const svg = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs>` +
      `<filter id="soft"><feGaussianBlur stdDeviation="22"/></filter>` +
      `<filter id="face-soft"><feGaussianBlur stdDeviation="14"/></filter>` +
      `<mask id="face">` +
      `<rect width="100%" height="100%" fill="black"/>` +
      `<ellipse cx="${SIZE * 0.5}" cy="${SIZE * 0.55}" rx="${SIZE * 0.345}" ry="${SIZE * 0.49}" fill="white" filter="url(#face-soft)"/>` +
      `</mask>` +
      `</defs>` +
      `<rect width="100%" height="100%" fill="black"/>` +
      `<g filter="url(#soft)" mask="url(#face)">${ellipses}</g>` +
      `<g filter="url(#face-soft)">${protectedEllipses}</g></svg>`,
  );
  // SVG input carries an alpha channel. Remove it before using this buffer as
  // a one-channel mask; otherwise RGBA bytes are misread as neighbouring alpha
  // pixels and the protection geometry is silently scrambled.
  const coverage = await sharp(svg)
    .removeAlpha()
    .toColourspace("b-w")
    .png()
    .toBuffer();
  return { coverage };
}

/** Restore the original photograph outside the permitted treatment zones. */
async function localiseResult(
  generated: Buffer,
  original: Buffer,
  masks: EditMasks | null,
): Promise<Buffer> {
  if (!masks) return generated;
  const alpha = await sharp(masks.coverage)
    .removeAlpha()
    .toColourspace("b-w")
    .raw()
    .toBuffer();
  const overlay = await sharp(generated)
    .resize(SIZE, SIZE, { fit: "fill" })
    .removeAlpha()
    .joinChannel(alpha, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .png()
    .toBuffer();
  return sharp(original)
    .composite([{ input: overlay, blend: "over" }])
    .jpeg({ quality: 95 })
    .toBuffer();
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Image generation is not configured." }, { status: 500 });
  }

  let body: {
    image?: unknown;
    afterImagePrompt?: unknown;
    preserve?: unknown;
    concerns?: unknown;
    /** Backward-compatible alias used by the older branded clinic clients. */
    areas?: unknown;
    hero?: unknown;
    /**
     * Older branded clients expect one JSON response rather than SSE. They
     * still run the exact same candidate, grading and verification pipeline;
     * only the response envelope differs.
     */
    responseMode?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const original = parseDataUrl(body.image);
  if (!original) {
    return NextResponse.json({ error: "A valid image is required." }, { status: 400 });
  }

  // CLAUDE'S BRIEF FIRST, TEMPLATE AS THE FLOOR. Claude is the only thing that
  // has looked at this face, and an image model answers a specific photographic
  // description far better than a generic one. The guard still refuses claims
  // the clinic cannot make; a refusal is logged with its reason, because the
  // silent version of this fallback is how every client ended up with the same
  // generic edit without anyone noticing.
  const verdict = inspectAfterBrief(body.afterImagePrompt);
  const hero =
    typeof body.hero === "object" && body.hero !== null
      ? (body.hero as HeroFocus)
      : null;
  const preserve = parsePreserve(body.preserve);
  const concerns = parseConcerns(body.concerns ?? body.areas);
  const matched = planFor(concerns);
  const glowStrength = concerns.some(
    (concern) =>
      concern.scope !== "preserve" &&
      concern.severity === "notable" &&
      /(hydrat|radiance|dull|glow|luminos)/i.test(`${concern.area} ${concern.concern}`),
  )
    ? 3
    : glowStrengthFromEnv();
  const firmnessStrength = matched.some((product) => product.id === "ultra-lift")
    ? firmnessStrengthFromEnv()
    : 0;
  const sessions = Math.max(...matched.map((product) => product.sessions), 3);
  const prompt = buildAfterImagePrompt(concerns, hero, {
    personalised: verdict.ok ? verdict.prompt : null,
    preserve,
    sessions,
  });
  console.log(
    verdict.ok
      ? "[transform] brief: claude-authored"
      : `[transform] brief: template (rejected: ${verdict.reason}` +
          `${verdict.term ? ` — "${verdict.term}"` : ""})`,
  );

  let square: Buffer;
  try {
    square = await sharp(original).resize(SIZE, SIZE, { fit: "cover" }).png().toBuffer();
  } catch {
    return NextResponse.json({ error: "That image could not be read." }, { status: 400 });
  }
  const editMasks = await buildEditMasks(concerns);

  /**
   * STREAMED, AND IT IS THE SINGLE BIGGEST THING WE CAN DO ABOUT THE WAIT.
   *
   * A high-quality edit takes ~200s and that is the model's floor — we are not
   * getting it down without giving up the quality that makes the result worth
   * showing. What we CAN change is that the client stared at a spinner for the
   * whole of it. With partial images, first byte lands in roughly 5-15s instead
   * of ~195s: they watch their own after photograph resolve rather than waiting
   * to find out whether one is coming.
   *
   * The total is unchanged. The perceived wait is transformed.
   *
   * partial_images must be >= 1. At 0 the API emits no events until completion,
   * and an idle SSE connection of that length draws 408s from proxies — the
   * streaming path is strictly worse than the plain one at 0.
   *
   * Partials are shown UNGRADED and unverified, deliberately. They are a
   * progress indicator that happens to look like the answer. The graded,
   * identity-checked final replaces whatever the client last saw.
   */
  const encoder = new TextEncoder();
  const started = Date.now();
  const deadlineAt = started + REQUEST_BUDGET_MS;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamOpen = true;
      const send = (payload: Record<string, unknown>) => {
        if (!streamOpen) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          streamOpen = false;
        }
      };
      // Quality comparison and identity verification do not produce image
      // partials. A small heartbeat keeps proxies and browsers from treating
      // that legitimate quiet period as a dead connection.
      const heartbeat = setInterval(
        () => send({ type: "heartbeat" }),
        15_000,
      );
      const batchAbort = new AbortController();
      let lastGenerationFailure: string | null = null;
      const budgetTimer = setTimeout(
        () => batchAbort.abort(),
        Math.max(1_000, REQUEST_BUDGET_MS - 1_000),
      );

      /**
       * One generation. Only the first candidate reports progress, because the
       * client's bar has four steps and four candidates ticking it at once
       * would race it to the end while the work was barely started.
       */
      const generate = async (
        text: string,
        reportProgress: boolean,
        quality: "low" | "medium" | "high" = QUALITY,
        source: Buffer = square,
      ): Promise<string | null> => {
        // RAW HTTP, NOT THE SDK. The installed openai SDK (4.104) has no
        // `partial_images` on the images resource — only on `responses`.
        // Passing `stream: true` through it did not error: it returned the
        // ordinary parsed response, `for await` fell back to iterating the
        // base64 STRING character by character, and dev died with "Map maximum
        // size exceeded" a couple of million promises later.
        const form = new FormData();
        form.append("model", "gpt-image-2");
        form.append(
          "image",
          new Blob([new Uint8Array(source)], { type: "image/png" }),
          "face.png",
        );
        // Do not submit the coverage image as an upstream edit mask. With
        // gpt-image-2 JPEG output that path can return opaque black holes in
        // the editable regions. The generated photograph is instead localised
        // below with the same feathered coverage image, restoring every pixel
        // outside the permitted zones from the client's original photograph.
        form.append("prompt", text);
        form.append("size", "1024x1024");
        form.append("quality", quality);
        // The endpoint defaults to PNG. A photographic JPEG at 95 keeps the
        // same visible detail while moving far fewer bytes through four API
        // responses and base64 decoders. The final local grade is JPEG already.
        form.append("output_format", "jpeg");
        form.append("output_compression", "95");
        if (reportProgress) {
          form.append("stream", "true");
          form.append("partial_images", String(PARTIALS));
        }
        // input_fidelity is deliberately absent: gpt-image-2 rejects it and
        // always processes reference images at high fidelity anyway.

        const remaining = deadlineAt - Date.now();
        if (remaining < 2_000) return null;
        const perCallCeiling = quality === "high" ? 180_000 : 135_000;
        const callAbort = new AbortController();
        const abortCall = () => callAbort.abort();
        const callTimer = setTimeout(
          abortCall,
          Math.max(1_000, Math.min(perCallCeiling, remaining - 1_000)),
        );
        batchAbort.signal.addEventListener("abort", abortCall, { once: true });
        try {
          const res = await fetch("https://api.openai.com/v1/images/edits", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
            signal: callAbort.signal,
          });
          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            lastGenerationFailure = `OpenAI image edit returned ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`;
            console.error(`[transform] upstream ${res.status}: ${detail.slice(0, 300)}`);
            return null;
          }

        // Only the candidate the client is watching needs partial frames.
        // Background candidates return ordinary JSON, avoiding three paid
        // partial renders per candidate that nobody ever sees.
          if (!reportProgress) {
            const payload = (await res.json()) as {
              data?: Array<{ b64_json?: string }>;
            };
            return payload.data?.[0]?.b64_json ?? null;
          }
          if (!res.body) return null;

          let b64: string | null = null;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
          // Keep the trailing fragment: a frame carrying a megabyte of base64
          // straddles many chunks.
            const frames = buf.split("\n\n");
            buf = frames.pop() ?? "";
            for (const frame of frames) {
              const line = frame.split("\n").find((l) => l.startsWith("data:"));
              if (!line) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              let event: { type?: string; b64_json?: string };
              try {
                event = JSON.parse(payload);
              } catch {
                continue;
              }
              if (event.type === "image_edit.partial_image") {
              // A CHECKPOINT, NOT A PICTURE — the client sees a progress bar,
              // never the model's half-finished draft. See PreviewProgress.
                if (reportProgress) send({ type: "partial" });
              } else if (event.type === "image_edit.completed" && event.b64_json) {
                b64 = event.b64_json;
              }
            }
          }
          return b64;
        } catch (error) {
          lastGenerationFailure =
            error instanceof Error ? error.message : "Image generation request failed.";
          throw error;
        } finally {
          clearTimeout(callTimer);
          batchAbort.signal.removeEventListener("abort", abortCall);
        }
      };

      try {
        /**
         * FIRST SAFE WINNER, FIRED TOGETHER.
         *
         * Two MEDIUM candidates preserve the quality insurance of multiple
         * draws, but we no longer wait for both once one is verified. This keeps
         * the successful path near one generation's latency and bounds outliers.
         */
        const candidatePrompts = [
          prompt,
          `${prompt}\n\nFINAL EMPHASIS: Show the strongest believable end-of-course improvement in the TREATABLE concerns only. Make the first treatable priority immediately visible at side-by-side size, while every excluded pigmentation pattern remains identical in colour, density, boundaries and position. A merely dewy or almost unchanged version is not successful.`,
          `${prompt}\n\nFINAL EMPHASIS: Preserve real pores, fine skin grain and local shine in the improved areas. The result must read as treated skin photographed by a camera, never retouched skin.`,
          `${prompt}\n\nFINAL EMPHASIS: At side-by-side comparison size, make the first treatment priority immediately visible while staying within every preservation and identity constraint.`,
        ];
        const safe = (v: Assessment | null) =>
          Boolean(
            v &&
              v.samePerson &&
              v.visible >= 3 &&
              v.photographic >= 3 &&
              v.targeted >= 3 &&
              v.credible >= 3 &&
              (v.preserved !== false),
          );
        const pigmentationPreservationCase = concerns.some(
          (concern) =>
            concern.scope === "preserve" &&
            /(pigment|melasma|discolou?r|brown patch)/i.test(
              `${concern.area} ${concern.concern}`,
            ),
        );
        const fallbackQualityFloor = pigmentationPreservationCase ? 2 : 3;
        const publishable = (v: Assessment | null) =>
          Boolean(
            v &&
              v.samePerson &&
              v.visible >= 2 &&
              v.photographic >= fallbackQualityFloor &&
              v.targeted >= fallbackQualityFloor &&
              v.credible >= fallbackQualityFloor &&
              (v.preserved !== false),
          );
        let generatedCount = 0;
        const makeCandidate = async (i: number) => {
            const candidateStarted = Date.now();
            const b64 = await generate(
              candidatePrompts[i % candidatePrompts.length],
              i === 0,
            );
            if (!b64) return null;

            generatedCount += 1;
            if (generatedCount === 1) send({ type: "stage", stage: 4 });
            if (generatedCount === 2) send({ type: "stage", stage: 5 });

            const graded = await hydrationGrade(
              Buffer.from(b64, "base64"),
              glowStrength,
              square,
              firmnessStrength,
            );
            const image = await localiseResult(graded, square, editMasks);
            const generatedMs = Date.now() - candidateStarted;
            const v = await assess(
              square,
              image,
              preserve,
              concerns,
              sessions,
              deadlineAt,
            );
            return {
              image,
              v,
              generatedMs,
              totalMs: Date.now() - candidateStarted,
            };
        };
        type Candidate = NonNullable<Awaited<ReturnType<typeof makeCandidate>>>;
        const pending = new Map<
          number,
          Promise<{ index: number; candidate: Candidate | null }>
        >();
        for (let i = 0; i < Math.max(1, CANDIDATES); i += 1) {
          pending.set(
            i,
            makeCandidate(i)
              .then((candidate) => ({ index: i, candidate }))
              .catch(() => ({ index: i, candidate: null })),
          );
        }

        const candidates: Candidate[] = [];
        let earlyWinner: Candidate | null = null;
        while (pending.size > 0) {
          const completed = await Promise.race(pending.values());
          pending.delete(completed.index);
          if (!completed.candidate) continue;
          candidates.push(completed.candidate);
          if (publishable(completed.candidate.v)) {
            earlyWinner = completed.candidate;
            break;
          }
        }

        // Conversion speed matters more than comparing two already-safe images.
        // Publish the first candidate that clears every gate, and stop spending
        // the client's time on slower background candidates.
        if (earlyWinner) {
          batchAbort.abort();
          send({
            type: "final",
            image: `data:image/jpeg;base64,${earlyWinner.image.toString("base64")}`,
            verified: earlyWinner.v?.samePerson ?? null,
            improved: earlyWinner.v ? earlyWinner.v.visible >= 3 : null,
            strong: safe(earlyWinner.v),
            preserved: earlyWinner.v?.preserved ?? null,
          });
          console.info(
            `[transform] first safe ${QUALITY} candidate published in ${((Date.now() - started) / 1000).toFixed(0)}s`,
          );
          return;
        }

        if (!candidates.length) {
          send({
            type: "error",
            error: "We couldn't generate your after image.",
            ...(process.env.NODE_ENV === "development" && lastGenerationFailure
              ? { debug: lastGenerationFailure }
              : {}),
          });
          return;
        }

        if (generatedCount < 2) send({ type: "stage", stage: 5 });
        let allGraded = candidates.map((candidate) => candidate.image);
        let judged = candidates.map((candidate) => candidate.v);

        // Rank on what the clinic needs: a result the client can SEE that still
        // looks like a photograph of them. `credible` blends both, so it leads,
        // with `photographic` as the tie-break against a convincing-but-plastic
        // winner. A candidate that is not the same person is unusable at any
        // score, so it is pushed to the bottom rather than merely penalised.
        // A result can be safe to show even when it falls short of the stronger
        // commercial visibility gate. Previously those identity-safe,
        // photographic results were thrown away and the UI blamed the input
        // photo. The stronger gate still triggers a correction pass; this one
        // decides only whether a completed image is honest enough to publish.
        const rank = (v: Assessment | null) =>
          !v
            ? 0
            : (safe(v) ? 1000 : 0) +
              (v.samePerson ? 100 : 0) +
              (v.preserved === false ? -100 : 0) +
              v.visible * 3 +
              v.credible * 3 +
              v.photographic * 2 +
              v.targeted;

        let order = allGraded
          .map((image, i) => ({ image, v: judged[i] }))
          .sort((a, b) => rank(b.v) - rank(a.v));

        // Do not publish a technically valid but commercially useless image.
        // If the medium batch contains no visible, credible and preserved
        // result, spend the high-quality call here — only on the consultations
        // that need it — and judge it by exactly the same gate.
        // Leave enough time for one corrected medium render and its verifier.
        // If the shared deadline is already tight, finish with the ranked batch
        // instead of starting work the browser cannot possibly receive.
        if (
          !order.some((candidate) => safe(candidate.v)) &&
          deadlineAt - Date.now() >= 55_000
        ) {
          send({ type: "stage", stage: 6 });
          const notes = judged
            .filter((v): v is Assessment => Boolean(v?.note))
            .map((v) => v.note)
            .slice(0, 3)
            .join(" ");
          const rescuePrompt =
            `${prompt}\n\nQUALITY CORRECTION\n` +
            `This is the strongest current AFTER draft, but it is still too subtle` +
            `${notes ? `: ${notes}` : "."} Do not reverse its existing improvements. ` +
            `Take the treatable changes one clear, believable step further so the ` +
            `difference is immediately visible in a 50/50 comparison. ` +
            `The improvement must be plainly visible, the person and framing must ` +
            `remain identical, excluded features must survive exactly, and real ` +
            `pores and fine skin grain must remain visible.`;
          // Iterate from the strongest current draft instead of asking the model
          // to start over from the untreated photograph. Starting over produced
          // another equally subtle draw; building on the best draft makes the
          // correction cumulative.
          const rescueSource = await sharp(order[0].image).png().toBuffer();
          const rescued = await generate(
            rescuePrompt,
            false,
            RESCUE_QUALITY,
            rescueSource,
          ).catch(() => null);
          if (rescued) {
            const rescuedGrade = await hydrationGrade(
              Buffer.from(rescued, "base64"),
              glowStrength,
              square,
              firmnessStrength,
            );
            const rescuedLocal = await localiseResult(
              rescuedGrade,
              square,
              editMasks,
            );
            const rescuedJudge = await assess(
              square,
              rescuedLocal,
              preserve,
              concerns,
              sessions,
              deadlineAt,
            );
            allGraded = [...allGraded, rescuedLocal];
            judged = [...judged, rescuedJudge];
            order = allGraded
              .map((image, i) => ({ image, v: judged[i] }))
              .sort((a, b) => rank(b.v) - rank(a.v));
          }
        }

        const best = order[0];
        const check = best.v;

        console.log(
          `[transform] ${QUALITY} x${candidates.length} in ${((Date.now() - started) / 1000).toFixed(0)}s — ` +
            `kept ${check ? `cred ${check.credible} photo ${check.photographic} vis ${check.visible}` : "unjudged"} ` +
            `of [${judged.map((v) => (v ? v.credible : "?")).join(", ")}]` +
            ` — candidate pipelines [${candidates
              .map(
                (candidate) =>
                  `${(candidate.generatedMs / 1000).toFixed(0)}>${(candidate.totalMs / 1000).toFixed(0)}s`,
              )
              .join(", ")}]` +
            (check ? ` — same person: ${check.samePerson}, preserved: ${check.preserved} (${check.note})` : ""),
        );

        // Every published preview must now clear the four gates clients and the
        // clinic actually care about: identity, visible difference, photographic
        // credibility and preservation of out-of-scope features.
        if (!check || !publishable(check)) {
          const reason = !check
            ? "verification"
            : !check.samePerson
              ? "identity"
              : check.preserved === false
                ? "preservation"
                : check.visible < 2
                  ? "visibility"
                  : check.targeted < 3
                    ? "targeting"
                    : "realism";
          send({
            type: "error",
            reason,
            error:
              reason === "verification"
                ? "The simulation could not be verified safely enough to show."
                : reason === "identity"
                ? "The simulation did not hold your likeness closely enough to show."
                : reason === "preservation"
                  ? "The simulation changed a feature the treatment cannot change."
                  : reason === "visibility"
                    ? "The simulated change was too subtle to be useful."
                    : reason === "targeting"
                      ? "The simulation changed too much outside the treatment priorities."
                      : "The simulation did not look photographic enough to show.",
            note: check?.note,
          });
        } else {
          send({
            type: "final",
            image: `data:image/jpeg;base64,${best.image.toString("base64")}`,
            verified: check?.samePerson ?? null,
            improved: check ? check.visible >= 3 : null,
            strong: check ? safe(check) : null,
            preserved: check?.preserved ?? null,
          });
        }
      } catch (err) {
        console.error("[transform] failed:", err);
        send({ type: "error", error: "We couldn't generate your after image." });
      } finally {
        batchAbort.abort();
        clearTimeout(budgetTimer);
        clearInterval(heartbeat);
        if (streamOpen) {
          streamOpen = false;
          controller.close();
        }
      }
    },
  });

  if (body.responseMode === "json") {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let image: string | null = null;
    let error = "We couldn't generate your after image.";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const line = frame.split("\n").find((item) => item.startsWith("data:"));
        if (!line) continue;
        try {
          const message = JSON.parse(line.slice(5).trim()) as {
            type?: string;
            image?: string;
            error?: string;
          };
          if (message.type === "final" && message.image) image = message.image;
          if (message.type === "error" && message.error) error = message.error;
        } catch {
          // A malformed progress frame must not hide a later valid final frame.
        }
      }
    }

    return image
      ? NextResponse.json({ image })
      : NextResponse.json({ error }, { status: 502 });
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform matters as much as no-cache: a proxy that buffers to
      // "optimise" the response would reassemble exactly the 200s wait this
      // exists to remove.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
