import { NextResponse } from "next/server";
import { validateLead } from "@/lib/validation";
import { pushConcernsToGhl, parseGhlMeta } from "@/lib/ghl";
import type { SkinAnalysis } from "@/lib/types";

export const runtime = "nodejs";

function isAnalysis(v: unknown): v is SkinAnalysis {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.summary === "string" &&
    Array.isArray(o.categories) &&
    Array.isArray(o.annotations) &&
    typeof o.veluriaRecommendation === "string"
  );
}

/**
 * Phase 2 of lead capture: fired by the client AFTER the skin analysis returns.
 * Sends the FULL lead (same fields as the first webhook) PLUS the concerns to
 * GHL, keyed by email so the existing contact is enriched. Best-effort — the
 * client calls this fire-and-forget, so a non-200 here never blocks results.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Reuse the lead validator so the second webhook carries a fully-formed
  // contact, identical to the first.
  const result = validateLead(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const analysis = (body as { analysis?: unknown }).analysis;
  if (!isAnalysis(analysis)) {
    return NextResponse.json(
      { error: "A valid analysis is required." },
      { status: 400 },
    );
  }

  const meta = parseGhlMeta((body as { meta?: unknown }).meta, req);

  try {
    await pushConcernsToGhl(result.lead, analysis, meta);
  } catch (err) {
    console.error("[concerns] GHL push failed:", err);
    return NextResponse.json(
      { error: "We couldn't submit your analysis details." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
