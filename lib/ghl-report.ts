// ─────────────────────────────────────────────────────────────────────────────
// Delivers the skin-analysis report PDF into GoHighLevel via the Private
// Integration: uploads the file, upserts the contact (deduped by email), pins a
// note with the link on the contact, and emails the client a copy with the PDF
// attached. No-ops cleanly when the GHL env isn't configured, and never throws —
// report delivery must never block the lead/result flow.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

function creds(): { token: string; locationId: string } | null {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) return null;
  if (token.includes("REPLACE") || locationId.includes("REPLACE")) return null;
  return { token, locationId };
}

export interface DeliverInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  pdfBase64: string;
  fileName: string;
  subject: string;
  emailHtml: string;
  noteBody: string; // may contain "{url}" placeholder
}

export interface DeliverResult {
  ok: boolean;
  skipped?: boolean;
  fileUrl?: string;
  contactId?: string;
  emailed?: boolean;
  noted?: boolean;
  error?: string;
}

export async function deliverReportToGhl(
  input: DeliverInput,
): Promise<DeliverResult> {
  const c = creds();
  if (!c) return { ok: false, skipped: true };

  const auth = {
    Authorization: `Bearer ${c.token}`,
    Version: VERSION,
    Accept: "application/json",
  };

  try {
    // 1 ── upload the PDF to the media library → hosted URL
    const bytes = Buffer.from(input.pdfBase64, "base64");
    const form = new FormData();
    form.append(
      "file",
      new Blob([bytes], { type: "application/pdf" }),
      input.fileName,
    );
    form.append("hosted", "false");
    form.append("name", input.fileName);
    form.append("locationId", c.locationId);
    const up = await fetch(`${BASE}/medias/upload-file`, {
      method: "POST",
      headers: auth, // do NOT set Content-Type — fetch adds the multipart boundary
      body: form,
    });
    const upj = (await up.json().catch(() => ({}))) as { url?: string };
    if (!up.ok || !upj.url) {
      return { ok: false, error: `media-upload ${up.status}` };
    }
    const fileUrl = upj.url;

    // 2 ── upsert the contact (deduped by email) → contactId, and write the report
    // URL into the custom field so downstream tooling reads it as structured data.
    // Field key is the bare GHL key (no "contact." prefix) via env override.
    const fieldKey = (
      process.env.GHL_REPORT_FIELD_KEY || "facial_app_report_pdf"
    ).trim();
    const upsertBody: Record<string, unknown> = {
      locationId: c.locationId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
    };
    if (fieldKey) {
      upsertBody.customFields = [{ key: fieldKey, field_value: fileUrl }];
    }
    const us = await fetch(`${BASE}/contacts/upsert`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify(upsertBody),
    });
    const usj = (await us.json().catch(() => ({}))) as {
      contact?: { id?: string };
    };
    const contactId = usj.contact?.id;
    if (!contactId) {
      return { ok: false, fileUrl, error: `contact-upsert ${us.status}` };
    }

    // 3 ── pin a note with the report link on the contact (always lands)
    let noted = false;
    try {
      const nt = await fetch(`${BASE}/contacts/${contactId}/notes`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ body: input.noteBody.replace("{url}", fileUrl) }),
      });
      noted = nt.ok;
    } catch {
      /* non-fatal */
    }

    // 4 ── email the client a copy with the PDF attached (also logs on the contact)
    let emailed = false;
    try {
      const em = await fetch(`${BASE}/conversations/messages`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "Email",
          contactId,
          subject: input.subject,
          html: input.emailHtml,
          attachments: [fileUrl],
        }),
      });
      emailed = em.ok;
    } catch {
      /* non-fatal — the report is still on the contact via the note + media */
    }

    return { ok: true, fileUrl, contactId, emailed, noted };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ghl-error" };
  }
}
