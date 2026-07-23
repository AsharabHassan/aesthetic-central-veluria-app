import type { LeadPayload, SkinAnalysis } from "./types";
import { META_PIXEL_ID } from "./meta";

/** Meta Conversions API fields forwarded to GHL for server-side event matching. */
export interface GhlMeta {
  event_id?: string;
  event_name?: string;
  event_source_url?: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  client_user_agent?: string;
  client_ip_address?: string;
}

/**
 * Builds GhlMeta from the client-sent `meta` object plus server-only signals
 * (user-agent + IP) read from the request headers. Shared by both the lead and
 * concerns routes so the two webhooks carry identical Meta fields.
 */
export function parseGhlMeta(input: unknown, req: Request): GhlMeta {
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<
    string,
    unknown
  >;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const ipHeader =
    req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  return {
    event_id: str(o.event_id),
    event_name: str(o.event_name) || "Lead",
    event_source_url: str(o.event_source_url),
    fbp: str(o.fbp),
    fbc: str(o.fbc),
    fbclid: str(o.fbclid),
    client_user_agent: req.headers.get("user-agent") ?? "",
    client_ip_address: ipHeader.split(",")[0]?.trim() ?? "",
  };
}

/**
 * Shapes the lead into the flat JSON GoHighLevel inbound webhooks expect.
 * Field names are chosen to map cleanly onto GHL contact fields + GHL's
 * Facebook Conversions API action.
 */
export function buildGhlPayload(lead: LeadPayload, meta: GhlMeta = {}) {
  const [firstName, ...rest] = lead.name.trim().split(/\s+/);
  return {
    // ---- CRM contact fields ----
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    full_name: lead.name.trim(),
    email: lead.email.trim().toLowerCase(),
    phone: lead.phone.trim(),
    skin_goals: lead.goals.join(", "),
    marketing_consent: lead.consent ? "yes" : "no",
    source: "Skin Analysis Lead Magnet",
    submitted_at: new Date().toISOString(),

    // ---- Meta Conversions API mapping (for GHL → Meta dedup) ----
    pixel_id: META_PIXEL_ID,
    action_source: "website",
    event_name: meta.event_name ?? "Lead",
    event_id: meta.event_id ?? "",
    event_source_url: meta.event_source_url ?? "",
    fbp: meta.fbp ?? "",
    fbc: meta.fbc ?? "",
    fbclid: meta.fbclid ?? "",
    client_user_agent: meta.client_user_agent ?? "",
    client_ip_address: meta.client_ip_address ?? "",
  };
}

export async function pushLeadToGhl(
  lead: LeadPayload,
  meta: GhlMeta = {},
): Promise<void> {
  const url = process.env.GHL_WEBHOOK_URL;
  if (!url) {
    // Not configured yet (e.g. local testing). Don't block the user's flow —
    // log the lead so it's visible, and let them reach their results.
    console.warn(
      "[ghl] GHL_WEBHOOK_URL not set — skipping CRM push. Lead:",
      JSON.stringify(buildGhlPayload(lead, meta)),
    );
    return;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGhlPayload(lead, meta)),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GHL webhook returned ${res.status}: ${body.slice(0, 200)}`);
  }
}

/**
 * The SECOND webhook, sent AFTER the analysis finishes. It carries EVERY field
 * the first (lead) webhook sends — reusing buildGhlPayload — PLUS the flattened
 * skin analysis, so the event is a complete, self-contained contact record.
 * Only `event_name` is overridden so the GHL workflow can branch on it; matched
 * to the existing contact by email (the workflow should upsert by email).
 */
export function buildConcernsPayload(
  lead: LeadPayload,
  analysis: SkinAnalysis,
  meta: GhlMeta = {},
) {
  return {
    // ---- All first-webhook fields (contact + Meta CAPI) ----
    ...buildGhlPayload(lead, meta),

    // Override the event label to distinguish from the initial "Lead" event.
    event_name: "SkinAnalysisCompleted",

    // ---- Flattened skin analysis ----
    skin_concerns: analysis.annotations.map((a) => a.area).join(", "),
    skin_scores: analysis.categories
      .map((c) => `${c.label}: ${c.score}`)
      .join(", "),
    skin_summary: analysis.summary,
    veluria_recommendation: analysis.veluriaRecommendation,
  };
}

/**
 * Best-effort: pushes the full lead + analysis concerns to GHL. Mirrors
 * pushLeadToGhl — same webhook URL, same "log and skip if not configured"
 * fallback so a failure never disrupts the user reaching their results.
 */
export async function pushConcernsToGhl(
  lead: LeadPayload,
  analysis: SkinAnalysis,
  meta: GhlMeta = {},
): Promise<void> {
  const url = process.env.GHL_WEBHOOK_URL;
  if (!url) {
    console.warn(
      "[ghl] GHL_WEBHOOK_URL not set — skipping concerns push. Payload:",
      JSON.stringify(buildConcernsPayload(lead, analysis, meta)),
    );
    return;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildConcernsPayload(lead, analysis, meta)),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GHL concerns webhook returned ${res.status}: ${body.slice(0, 200)}`,
    );
  }
}
