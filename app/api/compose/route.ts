import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  CANVAS,
  changeScore,
  composePatches,
  gradeWithinFace,
  type Patch,
} from "@/lib/compose";
import {
  firmnessStrengthFromEnv,
  glowStrengthFromEnv,
  hydrationGrade,
} from "@/lib/glow";

/**
 * The full-face "after": the close-ups that worked, put back onto the photo.
 *
 * The compositing itself is lib/compose.ts — see that file for why it moved out
 * of a Python service and what replaced the landmark mask. This route is the
 * HTTP edge: parse, compose, guarantee a floor, measure, return.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * How much the full-face result must differ from the client's own photograph
 * before we are willing to call it an "after".
 *
 * MUCH lower than /api/zone's floor of 10, and the two are not comparable
 * quantities even though they share a unit: a close-up crop is ALL concern, so
 * a change fills the frame, while the same change on a whole face is diluted by
 * the hair, background and clothing that make up most of the pixels.
 *
 * Measured on this pipeline, one real under-eye patch on a 1024² face:
 *   grade only, no patches      0.65   subtle but real
 *   grade + one accepted patch  1.57   crepe and crow's feet clearly softer
 * so 1.0 is what separates "we only relit the skin" from "a generated close-up
 * actually landed". Anchored on the same measurement it gates, which is the
 * mistake /api/zone's floor made on its first attempt.
 *
 * Below this we still return the image and flag it — a full-face result that is
 * honestly weak is worth showing next to strong close-ups, and unlike a dud
 * close-up it does not claim to be proof of anything on its own.
 */
const FULL_FACE_FLOOR = Number(process.env.COMPOSE_MAD_FLOOR ?? 1);

function parseDataUrl(dataUrl: unknown): Buffer | null {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(
    /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) return null;
  return Buffer.from(match[1], "base64");
}

function parsePatches(input: unknown): Patch[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => ({
      left: Number(p.left),
      top: Number(p.top),
      side: Number(p.side),
      image: parseDataUrl(p.image),
    }))
    .filter(
      (p): p is Patch =>
        Number.isFinite(p.left) &&
        Number.isFinite(p.top) &&
        Number.isFinite(p.side) &&
        p.side > 0 &&
        p.image !== null,
    );
}

export async function POST(req: Request) {
  let body: {
    image?: unknown;
    patches?: unknown;
    strength?: unknown;
    lift?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const original = parseDataUrl(body.image);
  const patches = parsePatches(body.patches);
  if (!original) {
    return NextResponse.json({ error: "A valid image is required." }, { status: 400 });
  }

  try {
    // The square the browser and /api/zone both work in. Every coordinate in a
    // patch is in this space, and it is also what the result is measured against
    // — comparing a composite against the un-normalised upload would score the
    // resize as if it were treatment.
    const square = await sharp(original)
      .resize(CANVAS, CANVAS, { fit: "cover" })
      .removeAlpha()
      .png()
      .toBuffer();

    const { image: composed, applied } = await composePatches(
      square,
      patches,
      typeof body.strength === "number" ? body.strength : 1,
    );

    // THE FLOOR, and the reason this route no longer returns the original when
    // every zone was rejected. Grading is a filter, not a generator: it cannot
    // invent or delete a feature, only relight one, so it is safe to run
    // unconditionally in a way a second generation pass would not be.
    //
    // Firmness is OPT-IN from the caller, not on by default: a client with no
    // laxity concern must not be shown a lift result from a product nobody
    // recommended them. Same gate /api/zone applies per zone.
    const graded = await hydrationGrade(
      composed,
      glowStrengthFromEnv(),
      square,
      body.lift === true ? firmnessStrengthFromEnv() : 0,
    );
    const result = await gradeWithinFace(composed, graded, patches);

    const score = await changeScore(result, square);
    console.log(
      `[compose] ${applied}/${patches.length} patches applied, ` +
        `change ${score.toFixed(2)} (floor ${FULL_FACE_FLOOR})`,
    );

    return NextResponse.json({
      image: `data:image/jpeg;base64,${result.toString("base64")}`,
      applied,
      changeScore: Number(score.toFixed(2)),
      weak: score < FULL_FACE_FLOOR,
    });
  } catch (err) {
    console.error("[compose] failed:", err);
    return NextResponse.json({ error: "Compose failed." }, { status: 502 });
  }
}
