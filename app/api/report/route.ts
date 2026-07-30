import { deliverReportToGhl } from "@/lib/ghl-report";

export const runtime = "nodejs";

const CLINIC_NAME = "Aesthetics Central Clinic";
const CLINIC_BYLINE = "Luton";
// The report email's "Book your consultation" link. Deliberately NOT the
// in-app NEXT_PUBLIC_CALENDAR_URL: the email points at the clinic's own
// white-label booking domain rather than the raw leadconnectorhq widget.
const BOOKING_URL =
  process.env.GHL_BOOKING_URL ??
  "https://link.aestheticscentral.co.uk/widget/bookings/free-veluria-online-consultation";
const WEBSITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://aestheticscentral.co.uk/";
// Sender identity for the report email. The address must be a verified sender
// or domain in the GHL sub-account, otherwise GHL rejects the send.
const EMAIL_FROM = process.env.GHL_EMAIL_FROM ?? "hello@aestheticscentral.co.uk";
const EMAIL_FROM_NAME = process.env.GHL_EMAIL_FROM_NAME ?? "Aesthetics Central";
const EMAIL_FROM_HEADER = `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`;

interface ReportRequest {
  lead?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  pdfBase64?: string;
}

// POST /api/report — the client builds the branded skin-analysis PDF and sends it
// here as base64. We upload it into GoHighLevel, attach it to the contact (custom
// field + note) and email the client a copy. Always returns 200 with a status
// summary so it never blocks the result flow.
export async function POST(request: Request): Promise<Response> {
  let body: ReportRequest;
  try {
    body = (await request.json()) as ReportRequest;
  } catch {
    return Response.json({ ok: false, error: "invalid json" });
  }

  const lead = body.lead;
  if (!lead?.email || !body.pdfBase64) {
    return Response.json({ ok: false, skipped: true });
  }

  const first = (lead.firstName ?? "").trim();
  const last = (lead.lastName ?? "").trim();

  const safeName = (first || "client").replace(/[^\w-]/g, "");
  const fileName = `Skin-Analysis-Report-${safeName}.pdf`;
  const subject = `${first || "Your"} personalised skin analysis`;

  const emailHtml = `
    <div style="font-family:Helvetica,Arial,sans-serif;color:#211d16;line-height:1.6">
      <p>Hi ${first || "there"},</p>
      <p>Thank you for taking the complimentary AI skin consultation at
      <strong>${CLINIC_NAME}</strong> — ${CLINIC_BYLINE}. Your personalised skin
      analysis, treatment map and before/after preview are attached as a PDF.</p>
      <p>It's a guide to help you prepare — the right plan for your skin is always
      confirmed in person. When you're ready, book your free consultation and our
      team will talk you through everything.</p>
      <p><a href="${BOOKING_URL}" style="color:#9a7b1f">Book your free consultation →</a></p>
      <p style="color:#5c5852">— <a href="${WEBSITE_URL}" style="color:#5c5852">${CLINIC_NAME}</a>, ${CLINIC_BYLINE}</p>
    </div>`;

  const noteBody = "📄 Skin analysis report (Aesthetics Central Clinic): {url}";

  const result = await deliverReportToGhl({
    firstName: first,
    lastName: last,
    email: lead.email,
    phone: lead.phone ?? "",
    pdfBase64: body.pdfBase64,
    fileName,
    subject,
    emailHtml,
    noteBody,
    emailFrom: EMAIL_FROM_HEADER,
  });

  // Surface failures in the server log without leaking the PDF.
  if (!result.ok && !result.skipped) {
    console.error("[api/report] GHL delivery failed:", result.error);
  }
  return Response.json(result);
}
