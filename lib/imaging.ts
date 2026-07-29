/**
 * Client for the Python imaging service (see imaging/).
 *
 * WHY THERE IS A SECOND SERVICE. The full-face "after" used to be a gpt-image-2
 * generation, and it was removed because it did not work: `images.edit`
 * re-renders the whole frame, so at full-face scale it retextures rather than
 * changes anything, and it drifts — the head moves, so the two halves of a
 * slider stop being the same photograph. Measured, the jaw region moved a mean
 * absolute ~11 across three prompt variants and looked identical every time.
 *
 * The lift is not a texture problem, it is a DISPLACEMENT — skin that has
 * retracted sits higher and the jaw margin moves. That is a warp, and a warp is
 * exact. Measured on the same subject, at three strengths: the jaw moves 6.6px,
 * 11.1px and 17.7px, the change in the jaw region scales 7.3 / 9.4 / 12.4, and
 * the change in the eye band is 0.00 at every setting. Perfectly registered,
 * identical every run, and it cannot invent or delete a feature because it only
 * resamples pixels that were already there.
 *
 * This is what makes a before/after slider viable again.
 */

const IMAGING_URL = process.env.IMAGING_URL ?? "http://127.0.0.1:8000";

export interface SimulateResult {
  image: string;
  applied: { liftStrength: number; liftPixels: number };
}

/**
 * The default lift, as a fraction of interocular distance.
 *
 * Swept on a real subject: 0.03 is honest but quiet, 0.08 is clearly visible
 * without reading as a facelift, and the hard ceiling in imaging/warp.py is
 * 0.09 so a mis-set env var cannot ship something the product cannot deliver.
 * 0.06 sits where the change is unmistakable at full-face scale and still
 * defensible as skin retraction over a full course.
 */
const DEFAULT_LIFT = Number(process.env.LIFT_STRENGTH ?? 0.06);

/**
 * Produce the geometrically-lifted "after".
 *
 * Returns null on any failure — a missing preview must degrade the page, never
 * break it, and the close-up reel below carries the proof regardless.
 */
export async function simulateLift(
  dataUrl: string,
  lift: number = DEFAULT_LIFT,
): Promise<SimulateResult | null> {
  try {
    const res = await fetch(`${IMAGING_URL}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl, lift }),
      // The warp itself is milliseconds; this bounds a service that is down or
      // wedged, so the page is never held open waiting for it.
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d?.ok || typeof d.image !== "string") return null;
    return { image: d.image, applied: d.applied };
  } catch {
    return null;
  }
}
