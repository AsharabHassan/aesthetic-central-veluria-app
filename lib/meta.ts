// Meta (Facebook) Pixel + Conversions API helpers.
// The browser Pixel and the server event (fired by GHL) share the same
// event_id so Meta can deduplicate them.

export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "2207166730106189";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq?: (...args: any[]) => void;
  }
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&") + "=([^;]*)"),
  );
  return m ? decodeURIComponent(m[1]) : "";
}

/** Meta browser id cookie (_fbp). */
export function getFbp(): string {
  return readCookie("_fbp");
}

/** Meta click id cookie (_fbc); reconstructed from ?fbclid if the cookie is absent. */
export function getFbc(): string {
  const existing = readCookie("_fbc");
  if (existing) return existing;
  if (typeof window === "undefined") return "";
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  return fbclid ? `fb.1.${Date.now()}.${fbclid}` : "";
}

export function getFbclid(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("fbclid") ?? "";
}

/** Unique id shared between the browser Pixel and the server CAPI event. */
export function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Fire the browser-side Lead conversion with a dedup event id. */
export function trackLead(eventId: string): void {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "Lead", {}, { eventID: eventId });
  }
}

/**
 * Fire a Meta event, standard or custom.
 *
 * The results page is a long scroll with several distinct moments on it — the
 * preview landing, the zoom being seen, the slider being dragged, a CTA being
 * clicked — and until now none of them were measured. We could see leads
 * arriving and consultations not being booked, with no way to tell whether
 * people were unmoved by the preview or never scrolled to it, which meant every
 * change to this page was a guess.
 *
 * Silent when the pixel is absent, which is the local and demo case.
 */
export function track(
  event: string,
  params: Record<string, string | number> = {},
  standard = false,
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq(standard ? "track" : "trackCustom", event, params);
}

/**
 * Mirror an event to the CRM so it lands on the contact's timeline and can be
 * joined against whether they actually turned up.
 *
 * sendBeacon where available: these fire during scroll and on a click that
 * navigates away, and a normal fetch is not guaranteed to survive either.
 */
export function trackServer(
  email: string | null | undefined,
  event: string,
  detail: Record<string, string> = {},
): void {
  if (!email || typeof window === "undefined") return;
  const body = JSON.stringify({
    email,
    event,
    ...detail,
    meta: {
      event_name: event,
      event_source_url: window.location.href,
      fbp: getFbp(),
      fbc: getFbc(),
      fbclid: getFbclid(),
    },
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/lead/event",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  fetch("/api/lead/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
