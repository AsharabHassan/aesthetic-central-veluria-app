import { NextResponse } from "next/server";
import { buildEventPayload, parseGhlMeta } from "@/lib/ghl";

export const runtime = "nodejs";

/**
 * Only events this app fires. An open string field would let anything through.
 *
 * Rebuilt around the close-up reel, which is now the entire visual proof. It
 * was also the one section with NO CRM telemetry: `ConcernZoomsViewed` and
 * `ConcernZoomsReady` were fired by the page but missing from this list, so
 * every one of them was rejected with a 400 and only ever reached the pixel.
 *
 * `SliderDragged` is back: the full-face before/after returned, driven by a
 * landmark warp instead of a generation. Dropped: `PreviewViewed`, and
 * `HeroZoomViewed` / `ProgressionStepped`, whose components were deleted — two
 * of the six originally allow-listed events could never fire at all.
 */
const ALLOWED = new Set([
  "ReelViewed",
  "SliderDragged",
  "ConcernZoomsViewed",
  "ConcernZoomsReady",
  "BookingClicked",
  "ReportCompleted",
]);

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Results-page funnel events, mirrored into GHL so they land on the contact's
 * timeline alongside the lead and the analysis.
 *
 * WHY. We could see interest and no bookings, with nothing in between: no way
 * to tell whether people looked at their preview and were unmoved, or never
 * scrolled to it at all. Those two have opposite fixes. This makes the next
 * change to the page measurable instead of a guess, and because the events
 * carry the email they can be joined against who actually attended.
 *
 * Best-effort by design — usually arrives via sendBeacon, whose response
 * nobody reads. A failure here must never surface to the client.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const email = str(body.email).toLowerCase();
  const event = str(body.event);
  if (!email || !ALLOWED.has(event)) {
    return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  }

  const url = process.env.GHL_WEBHOOK_URL;
  const payload = buildEventPayload(
    email,
    event,
    {
      plan: str(body.plan),
      focus: str(body.focus),
      placement: str(body.placement),
    },
    parseGhlMeta(body.meta, req),
  );

  if (!url) {
    console.warn("[event] GHL_WEBHOOK_URL not set —", JSON.stringify(payload));
    return NextResponse.json({ ok: true });
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[event] GHL push failed:", err);
  }

  // Always 200: the client cannot act on a failure and sendBeacon ignores this.
  return NextResponse.json({ ok: true });
}
