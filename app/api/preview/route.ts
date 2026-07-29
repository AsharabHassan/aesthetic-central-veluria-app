import { NextResponse } from "next/server";
import sharp from "sharp";
import { simulateLift } from "@/lib/imaging";
import {
  firmnessStrengthFromEnv,
  glowStrengthFromEnv,
  hydrationGrade,
} from "@/lib/glow";

/**
 * The full-face "after" for the before/after slider.
 *
 * TWO DETERMINISTIC PASSES, NO MODEL, NO GPU, NO PER-IMAGE COST.
 *
 *   1. THE LIFT — a landmark-driven warp in the Python imaging service. This is
 *      the half that no amount of prompt engineering ever produced: six
 *      rewrites of a gpt-image-2 prompt could not move a jaw margin, because an
 *      image-edit model has no notion of "move this edge by four millimetres".
 *      A warp does, exactly, and identically on every run.
 *
 *   2. THE SKIN — lib/glow.ts, already tuned against real client photos. Sheen,
 *      veil, and the one-sided difference-of-Gaussians that makes creases
 *      shallower without deepening a bump.
 *
 * Both are filters over the client's own pixels, so the result overlays the
 * original perfectly — which is the property the slider depends on and the one
 * the generated version could never guarantee. It also means a mole, a
 * capillary, a freckle or an active blemish survives by construction rather
 * than by being asked to.
 */

export const runtime = "nodejs";
// Seconds, not minutes: the warp is milliseconds and the grade is a handful of
// sharp passes. Nothing here waits on a generation.
export const maxDuration = 60;

function parseDataUrl(dataUrl: unknown): Buffer | null {
  if (typeof dataUrl !== "string") return null;
  const m = dataUrl.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/,
  );
  return m ? Buffer.from(m[2], "base64") : null;
}

export async function POST(req: Request) {
  let body: { image?: unknown; lift?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const original = parseDataUrl(body.image);
  if (!original) {
    return NextResponse.json(
      { error: "A valid image is required." },
      { status: 400 },
    );
  }

  try {
    const lift =
      typeof body.lift === "number" && Number.isFinite(body.lift)
        ? Math.max(0, Math.min(0.09, body.lift))
        : undefined;

    const lifted = await simulateLift(body.image as string, lift);
    if (!lifted) {
      // The imaging service is unavailable. Say so rather than silently
      // returning the untouched photo as an "after" — a before/after where the
      // after is the before is the single most damaging thing this page can do.
      return NextResponse.json(
        { error: "Preview service unavailable." },
        { status: 503 },
      );
    }

    const warped = parseDataUrl(lifted.image);
    if (!warped) {
      return NextResponse.json(
        { error: "Preview service returned an unreadable image." },
        { status: 502 },
      );
    }

    // The skin pass runs on top of the lift, not instead of it: firmness is
    // structure, hydration is sheen, and a treated face shows both.
    const graded = await hydrationGrade(
      warped,
      glowStrengthFromEnv(),
      original,
      firmnessStrengthFromEnv(),
    );

    // Measured against the client's own photo, and returned, so the page can
    // refuse to show a preview that did not actually change anything.
    const norm = (b: Buffer) =>
      sharp(b).resize(512, 512, { fit: "fill" }).greyscale().png().toBuffer();
    const [a, b] = await Promise.all([norm(graded), norm(original)]);
    const diff = await sharp(a)
      .composite([{ input: b, blend: "difference" }])
      .png()
      .toBuffer();
    const changeScore = (await sharp(diff).stats()).channels[0].mean;

    return NextResponse.json({
      image: `data:image/jpeg;base64,${graded.toString("base64")}`,
      applied: lifted.applied,
      changeScore: Number(changeScore.toFixed(2)),
    });
  } catch (err) {
    console.error("[preview] failed:", err);
    return NextResponse.json(
      { error: "We couldn't build your preview." },
      { status: 502 },
    );
  }
}
