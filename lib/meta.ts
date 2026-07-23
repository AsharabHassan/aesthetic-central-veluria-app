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
