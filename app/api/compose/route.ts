import { NextResponse } from "next/server";
import sharp from "sharp";

/**
 * The full-face "after", assembled from the close-ups that actually worked.
 *
 * WHY ASSEMBLED RATHER THAN GENERATED. A single full-face generation does not
 * change anything: `images.edit` re-renders the frame, so at that scale any one
 * area is a few hundred pixels and comes back retextured. Measured, the jaw
 * moved ~11 across three prompt variants and looked identical every time. The
 * SAME areas generated on their own 1024px crops score 16-23 and are
 * unmistakable. So the close-ups are the result; this puts them back.
 *
 * The compositing itself is in imaging/compose.py, because it needs face
 * landmarks: every patch is masked to the skin of the face, so background, hair,
 * clothing and the silhouette are never sourced from a generated image. That is
 * what makes the seam impossible — an earlier attempt at this pasted
 * rectangular crops and left a visible box where the model's invented grey wall
 * met the client's black top.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const IMAGING_URL = process.env.IMAGING_URL ?? "http://127.0.0.1:8000";

interface PatchIn {
  left: number;
  top: number;
  side: number;
  image: string;
}

function parsePatches(input: unknown): PatchIn[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => ({
      left: Number(p.left),
      top: Number(p.top),
      side: Number(p.side),
      image: typeof p.image === "string" ? p.image : "",
    }))
    .filter(
      (p) =>
        Number.isFinite(p.left) &&
        Number.isFinite(p.top) &&
        Number.isFinite(p.side) &&
        p.side > 0 &&
        p.image.startsWith("data:image/"),
    );
}

export async function POST(req: Request) {
  let body: { image?: unknown; patches?: unknown; strength?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const image = typeof body.image === "string" ? body.image : "";
  const patches = parsePatches(body.patches);
  if (!image.startsWith("data:image/") || patches.length === 0) {
    return NextResponse.json(
      { error: "An image and at least one patch are required." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${IMAGING_URL}/compose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image,
        patches,
        strength: typeof body.strength === "number" ? body.strength : 1.0,
      }),
      // Pure CPU compositing — a couple of seconds at most. The bound is for a
      // service that is down, not for the work.
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Preview service unavailable." },
        { status: 503 },
      );
    }
    const d = await res.json();
    if (!d?.ok || typeof d.image !== "string") {
      return NextResponse.json(
        { error: d?.reason ?? "Compose failed." },
        { status: 502 },
      );
    }

    // Measured against the original so the page can refuse to show a full-face
    // "after" that does not actually differ from the client's own photograph —
    // the single most damaging thing a before/after can do.
    const buf = (s: string) => Buffer.from(s.split(",")[1] ?? "", "base64");
    const norm = (b: Buffer) =>
      sharp(b).resize(512, 512, { fit: "fill" }).greyscale().png().toBuffer();
    const [a, b] = await Promise.all([norm(buf(d.image)), norm(buf(image))]);
    const diff = await sharp(a)
      .composite([{ input: b, blend: "difference" }])
      .png()
      .toBuffer();
    const changeScore = (await sharp(diff).stats()).channels[0].mean;

    return NextResponse.json({
      image: d.image,
      applied: d.applied,
      changeScore: Number(changeScore.toFixed(2)),
    });
  } catch (err) {
    console.error("[compose] failed:", err);
    return NextResponse.json({ error: "Compose failed." }, { status: 502 });
  }
}
