import type { HeroZone } from "./hero";
import type { VeluriaProduct } from "./veluria";

/**
 * Builds the booking link so the plan travels with the click.
 *
 * WHY. The calendar link used to be a bare URL. Someone arrived at the booking
 * form as an anonymous slot request, and the clinic opened the call knowing
 * nothing the app had already worked out — which products their concerns
 * matched, how many sessions that is, or which area they were actually looking
 * at when they decided to book. The lead was warm and the call started cold.
 *
 * Everything here is derived from what the client was already shown on the
 * results page, so the booking record and the report agree.
 */

/** Where on the page the click came from, so we can see which CTA converts. */
export type CtaPlacement =
  | "score"
  | "hero-zoom"
  | "preview"
  | "stack"
  | "rejuvenation"
  | "case-study"
  | "sticky"
  | "footer";

export interface BookingContext {
  plan: VeluriaProduct[];
  hero?: HeroZone | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  placement: CtaPlacement;
}

/**
 * "Veluria Ultra Lift, Veluria Silk Skin"
 *
 * Product names only. This string is written into a query parameter on the
 * calendar link, where GHL can surface it in a prefilled form field the client
 * reads — so it must not carry a session count. It used to ("Ultra Lift x5"),
 * which quoted the client a course length before the doctor had seen them.
 * The clinic knows its own protocol; what it needs from us is which products
 * the skin matched.
 */
export function planSummary(plan: VeluriaProduct[]): string {
  return plan.map((p) => p.name).join(", ");
}

export function bookingUrl(base: string, ctx: BookingContext): string {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    // A malformed NEXT_PUBLIC_CALENDAR_URL must not break the only CTA on the
    // page — send them to the unadorned link instead.
    return base;
  }

  const set = (key: string, value: string | null | undefined) => {
    const v = (value ?? "").trim();
    if (v) url.searchParams.set(key, v);
  };

  // GHL calendar widgets prefill from these.
  const [first, ...rest] = (ctx.name ?? "").trim().split(/\s+/);
  set("first_name", first);
  set("last_name", rest.join(" "));
  set("email", ctx.email);
  set("phone", ctx.phone);

  set("plan", planSummary(ctx.plan));
  set("focus", ctx.hero?.area);
  set("utm_source", "skin-scan");
  set("utm_medium", "ai-report");
  set("utm_content", ctx.placement);

  return url.toString();
}
