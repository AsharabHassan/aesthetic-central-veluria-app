import { NextResponse } from "next/server";
import { validateLead } from "@/lib/validation";
import { pushLeadToGhl, parseGhlMeta } from "@/lib/ghl";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = validateLead(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const meta = parseGhlMeta((body as { meta?: unknown })?.meta, req);

  try {
    await pushLeadToGhl(result.lead, meta);
  } catch (err) {
    console.error("[lead] GHL push failed:", err);
    return NextResponse.json(
      { error: "We couldn't submit your details. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
