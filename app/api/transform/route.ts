import { NextResponse } from "next/server";

import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";
import { buildAfterImagePrompt } from "@/lib/prompts";
import { inspectAfterBrief } from "@/lib/promptGuard";
import { hydrationGrade, glowStrengthFromEnv } from "@/lib/glow";
import type { ConcernArea } from "@/lib/prompts";
import type { HeroFocus } from "@/lib/hero";

/**
 * THE "AFTER" PHOTOGRAPH. One whole-face edit, not an assembly of crops.
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
 * Four medium candidates cost $0.21 — the same as ONE high image, which
 * measured no better than a single medium one — and run in parallel, so the
 * client waits ~70s rather than ~190s. The spread WITHIN one config (4, 3, 3, 1
 * on credibility for the same face and prompt) is wider than the gap between
 * any two configs tested, which is why picking from a handful beats tuning.
 */
const CANDIDATES = Number(process.env.AFTER_CANDIDATES ?? 4);
const VERIFY_MODEL = "claude-sonnet-5";
/**
 * How many progressive renders to stream before the final image.
 *
 * Each costs 100 image output tokens — pennies against a $0.21 generation, and
 * the difference between a blank spinner and watching the result appear. Must
 * be at least 1; see the streaming note in POST.
 */
const PARTIALS = Number(process.env.AFTER_PARTIAL_IMAGES ?? 3);

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
): Promise<Assessment | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const client = new Anthropic({ apiKey: key });
    const shrink = (b: Buffer) =>
      sharp(b).resize(640, 640, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
    const [b1, b2] = await Promise.all([shrink(before), shrink(after)]);

    const msg = await client.messages.create({
      model: VERIFY_MODEL,
      max_tokens: 300,
      thinking: { type: "disabled" },
      system:
        "You are auditing a simulated 'after' photograph for an aesthetics clinic. Image 1 is the " +
        "client's real photograph, image 2 the simulation. Score 1-5 and reply with ONLY JSON.\n" +
        "visible: 5 = a client would immediately SEE the improvement side by side. 1 = the two look " +
        "the same; an unchanged image scores 1 here, never high.\n" +
        "photographic: 5 = an unretouched camera file with individual pores and skin grain visible. " +
        "1 = a beauty filter: poreless, waxy, plastic, blurred.\n" +
        "targeted: 5 = the improvement sits in the concern areas and the rest of the face is " +
        "untouched. 1 = the whole face has been uniformly smoothed.\n" +
        "credible: 5 = a clinician would accept it as a real 12-week skin-treatment result AND it " +
        "clearly shows one. 1 = either obviously a filter, or shows no result at all.\n" +
        "samePerson: true only if it is unmistakably the same individual — same bone structure, eye " +
        "shape and colour, eyebrows, hairline, apparent age, skin tone and depth, pose and framing. " +
        "Softer lines and clearer skin are expected and must NOT count against it; changed eyebrows, " +
        "a reshaped nose or jaw, a different apparent age or a lightened skin tone must.\n" +
        (preserve.length
          ? "preserved: are ALL of these still present and unchanged — same size, shape, colour and " +
            "position? " + preserve.map((p) => `"${p}"`).join("; ") +
            ". This treatment cannot change them, so a picture that does is a false claim.\n"
          : "") +
        'Reply exactly: {"visible":n,"photographic":n,"targeted":n,"credible":n,"samePerson":bool,' +
        (preserve.length ? '"preserved":bool,' : "") +
        '"note":"one short sentence"}',
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Image 1 — the client's own photograph:" },
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b1.toString("base64") } },
            { type: "text", text: "Image 2 — the simulation:" },
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b2.toString("base64") } },
          ],
        },
      ],
    });

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
      preserved: preserve.length ? p.preserved === true : null,
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
    .map((c) => ({
      area: typeof c.area === "string" ? c.area.trim() : "",
      concern: typeof c.concern === "string" ? c.concern.trim() : "",
    }))
    .filter((c) => c.area.length > 0);
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
    hero?: unknown;
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
  const base = verdict.ok
    ? verdict.prompt
    : buildAfterImagePrompt(parseConcerns(body.concerns), false, false, hero);

  /**
   * THE UNTREATABLE LIST IS APPENDED HERE, NOT LEFT TO THE BRIEF.
   *
   * Claude is asked to include it and usually does, but "usually" is the wrong
   * standard for this one. A mole, a skin tag, rosacea, melasma, active acne, a
   * thread vein — a skin booster does not touch any of them, so a simulation
   * that quietly clears them is a false claim about a medical treatment, and
   * for a clinic that is an advertising-standards problem rather than a bug.
   *
   * It goes LAST because the last instruction carries weight, and it is phrased
   * as "still exactly as they are" rather than a prohibition, because naming
   * the thing to keep survives the edit better than forbidding its removal.
   */
  /**
   * THE EXCLUSION CLAUSE, and it is phrased this way because the plain version
   * did not work.
   *
   * Simply listing what to keep loses to the brief above it. That brief asks for
   * smoother texture, more even tone and clearer skin, and the model applies
   * those to the WHOLE face — including the very features we are asking it to
   * leave alone. Measured on three faces with acne and pigmentation, "keep
   * these unchanged" came back preserved=false every time: the lesions were
   * still in place but visibly calmer.
   *
   * So it does not merely repeat the prohibition. It (1) scopes the improvements
   * explicitly to the surrounding skin, resolving the contradiction at its
   * source, (2) names the ATTRIBUTE — colour and intensity — because "keep the
   * spot" is satisfied by a spot that is no longer red, and (3) gives a positive
   * target: against clearer skin these should stand out MORE, not less. A model
   * given something to aim at follows better than one given only a list of
   * things not to do.
   */
  const prompt = preserve.length
    ? `${base}\n\n` +
      `EXCLUDED FROM EVERY IMPROVEMENT DESCRIBED ABOVE. The smoother texture, ` +
      `softer lines, more even tone and clearer skin described above apply ONLY ` +
      `to the surrounding skin. This treatment does not act on the following at ` +
      `all, and they must appear in the after photograph exactly as they do in ` +
      `the original — same colour, same intensity, same darkness, same redness, ` +
      `same size, same number, same position:\n${preserve
        .map((p) => `- ${p}`)
        .join("\n")}\n\n` +
      `Anything red stays exactly as red. Anything inflamed stays exactly as ` +
      `inflamed. Anything brown stays exactly as brown and exactly as dark. Do ` +
      `not calm, fade, desaturate, soften, even out, blend, clear, reduce or ` +
      `thin out any of them, and do not reduce how many there are.\n\n` +
      `Because the skin around them is clearer, they should stand out MORE in ` +
      `the after photograph than in the original, not less. That is the correct ` +
      `result: healthy skin surrounding untreated marks.`
    : base;
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      /**
       * One generation. Only the first candidate reports progress, because the
       * client's bar has four steps and four candidates ticking it at once
       * would race it to the end while the work was barely started.
       */
      const generate = async (text: string, reportProgress: boolean): Promise<string | null> => {
        // RAW HTTP, NOT THE SDK. The installed openai SDK (4.104) has no
        // `partial_images` on the images resource — only on `responses`.
        // Passing `stream: true` through it did not error: it returned the
        // ordinary parsed response, `for await` fell back to iterating the
        // base64 STRING character by character, and dev died with "Map maximum
        // size exceeded" a couple of million promises later.
        const form = new FormData();
        form.append("model", "gpt-image-2");
        form.append("image", new Blob([new Uint8Array(square)], { type: "image/png" }), "face.png");
        form.append("prompt", text);
        form.append("size", "1024x1024");
        form.append("quality", QUALITY);
        form.append("stream", "true");
        form.append("partial_images", String(PARTIALS));
        // input_fidelity is deliberately absent: gpt-image-2 rejects it and
        // always processes reference images at high fidelity anyway.

        const res = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal: AbortSignal.timeout(290_000),
        });
        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          console.error(`[transform] upstream ${res.status}: ${detail.slice(0, 300)}`);
          return null;
        }

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
      };

      try {
        /**
         * BEST OF N, FIRED TOGETHER — the lever that finally moved this.
         *
         * A single generation is not the model's answer, it is one draw from a
         * wide distribution. Measured on the same face, same prompt, same tier,
         * four candidates scored 4, 3, 3 and 1 out of 5 on credibility: the
         * spread within one config is larger than the gap between any two
         * configs tested all session. Judging four and keeping the best lifts
         * the typical result from ~2.5 to ~3.5.
         *
         * It also reprices the whole thing. Four MEDIUM candidates cost $0.21 —
         * exactly one HIGH image, which measured no better than a single medium
         * one — and because they run in parallel the client waits ~70s instead
         * of ~190s. Better result, a third of the wait, same money.
         */
        const shots = await Promise.all(
          Array.from({ length: Math.max(1, CANDIDATES) }, (_, i) => generate(prompt, i === 0)),
        );
        const made = shots.filter((s): s is string => s !== null);
        if (!made.length) {
          send({ type: "error", error: "We couldn't generate your after image." });
          controller.close();
          return;
        }

        const graded = await Promise.all(
          made.map((b64) =>
            // The tone lock earns its place here: measured, gpt-image-2 raised
            // facial luminance 46% on a Black subject, and that is
            // skin-lightening whatever the prompt said. hydrationGrade applies
            // it FIRST, against raw output. Firmness stays off — turning the
            // grade up was measured and made the result LESS different, because
            // its tone lock pulls back toward the client's own photograph.
            hydrationGrade(Buffer.from(b64, "base64"), glowStrengthFromEnv(), square, 0),
          ),
        );
        const judged = await Promise.all(graded.map((g) => assess(square, g, preserve)));

        // Rank on what the clinic needs: a result the client can SEE that still
        // looks like a photograph of them. `credible` blends both, so it leads,
        // with `photographic` as the tie-break against a convincing-but-plastic
        // winner. A candidate that is not the same person is unusable at any
        // score, so it is pushed to the bottom rather than merely penalised.
        const rank = (v: Assessment | null) =>
          !v ? 0
            : (v.samePerson ? 100 : 0) +
              v.credible * 2 + v.photographic + v.visible + v.targeted;

        const order = graded
          .map((image, i) => ({ image, v: judged[i] }))
          .sort((a, b) => rank(b.v) - rank(a.v));
        const best = order[0];
        const check = best.v;

        console.log(
          `[transform] ${QUALITY} x${made.length} in ${((Date.now() - started) / 1000).toFixed(0)}s — ` +
            `kept ${check ? `cred ${check.credible} photo ${check.photographic} vis ${check.visible}` : "unjudged"} ` +
            `of [${judged.map((v) => (v ? v.credible : "?")).join(", ")}]` +
            (check ? ` — same person: ${check.samePerson}, preserved: ${check.preserved} (${check.note})` : ""),
        );

        // REFUSE ON IDENTITY ONLY. Showing someone a face that is not theirs is
        // the one failure worse than showing no result — everything else the
        // page can qualify in words, but it cannot un-show a stranger.
        if (check && !check.samePerson) {
          send({
            type: "error",
            reason: "identity",
            error: "The simulation did not hold your likeness closely enough to show.",
            note: check.note,
          });
        } else {
          send({
            type: "final",
            image: `data:image/jpeg;base64,${best.image.toString("base64")}`,
            verified: check?.samePerson ?? null,
            improved: check ? check.visible >= 3 : null,
            preserved: check?.preserved ?? null,
          });
        }
      } catch (err) {
        console.error("[transform] failed:", err);
        send({ type: "error", error: "We couldn't generate your after image." });
      }
      controller.close();
    },
  });

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
