import type { SkinAnalysis } from "./types";
import { expectedImprovement } from "./expectations";
import { DISCLAIMER_FULL } from "./legal";

/** Trigger a browser download of a data URL (e.g. a generated PNG). */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/** Draw an image cover-cropped (centered) into a destination rectangle. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const scale = Math.max(dw / img.width, dh / img.height);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bg: string,
  fg: string,
): void {
  ctx.font = "600 34px Helvetica, Arial, sans-serif";
  const padX = 26;
  const h = 64;
  const w = ctx.measureText(text).width + padX * 2;
  const r = h / 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2 + 2);
}

/**
 * Stitch the REAL (untouched) before selfie and the generated after into one
 * labelled side-by-side image, so the downloadable / PDF artifact is a genuine
 * before/after rather than a re-rendered collage. Defaults to PNG for the
 * standalone image download; pass "jpeg" for the PDF, where JPEG keeps the file
 * small (a photographic PNG bloats the PDF to several MB and makes it slow to open).
 */
export async function composeBeforeAfter(
  before: string,
  after: string,
  format: "png" | "jpeg" = "png",
  quality = 0.9,
): Promise<string> {
  const PANEL = 1024;
  const W = PANEL * 2;
  const H = PANEL;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return after;

  const [b, a] = await Promise.all([loadImage(before), loadImage(after)]);
  drawCover(ctx, b, 0, 0, PANEL, H);
  drawCover(ctx, a, PANEL, 0, PANEL, H);

  // Divider between the two panels.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(PANEL - 3, 0, 6, H);

  drawPill(ctx, "BEFORE", 32, 32, "rgba(255,255,255,0.9)", "#212121");
  drawPill(ctx, "AFTER", PANEL + 32, 32, "#212121", "#ffffff");

  return format === "jpeg"
    ? canvas.toDataURL("image/jpeg", quality)
    : canvas.toDataURL("image/png");
}

/**
 * Re-encode an (opaque) image data URL to JPEG to keep the PDF small. Fills a
 * white matte first so any alpha in the source doesn't render as black.
 */
async function toJpeg(dataUrl: string, quality = 0.82): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}

export interface AnalysisPdfOptions {
  analysis: SkinAnalysis;
  before: string;
  after: string | null;
  map: string | null;
}

/**
 * Build the branded analysis PDF and return the jsPDF document. jsPDF is
 * imported dynamically so it stays out of the initial bundle. Shared by the
 * client-side download and the base64 encoder used for GHL report delivery.
 */
async function buildAnalysisPdf(opts: AnalysisPdfOptions) {
  const { analysis, before, after, map } = opts;
  // Build the labelled side-by-side before/after (real selfie + generated after).
  // JPEG here (not PNG): a photographic PNG bloats the PDF to several MB, which
  // makes the emailed / GHL-hosted report slow to open.
  const beforeAfter = after
    ? await composeBeforeAfter(before, after, "jpeg", 0.82)
    : null;
  const mapJpeg = map ? await toJpeg(map, 0.82) : null;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const cw = pageW - margin * 2;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const heading = (text: string, size = 13) => {
    ensure(size + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(33, 29, 22);
    doc.text(text, margin, y);
    y += size + 4;
  };
  const body = (text: string, size = 11, color: [number, number, number] = [60, 55, 45]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, cw) as string[];
    ensure(lines.length * (size + 3));
    doc.text(lines, margin, y);
    y += lines.length * (size + 3) + 8;
  };
  // Small rounded pill badge — carries the same Expected / consult flags the
  // web report shows.
  const pill = (
    text: string,
    px: number,
    py: number,
    bg: [number, number, number],
    fg: [number, number, number],
  ): void => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const padX = 6;
    const h = 13;
    const w = doc.getTextWidth(text) + padX * 2;
    doc.setFillColor(...bg);
    doc.roundedRect(px, py, w, h, h / 2, h / 2, "F");
    doc.setTextColor(...fg);
    doc.text(text, px + padX, py + h / 2 + 2.6);
  };
  // Prominent amber-tinted disclaimer box — matches the on-screen notices.
  const disclaimerBox = () => {
    const padX = 10;
    const padY = 9;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(DISCLAIMER_FULL, cw - padX * 2) as string[];
    const boxH = padY * 2 + 12 + lines.length * 11;
    ensure(boxH + 6);
    doc.setDrawColor(214, 158, 46);
    doc.setFillColor(252, 246, 232);
    doc.roundedRect(margin, y, cw, boxH, 6, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(150, 101, 42);
    doc.text("IMPORTANT — PLEASE READ", margin + padX, y + padY + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 62, 20);
    doc.text(lines, margin + padX, y + padY + 18);
    y += boxH + 12;
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(33, 33, 33);
  doc.text("AESTHETICS CENTRAL", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(154, 123, 31);
  doc.text("AI Skin Consultation · aestheticscentral.co.uk", margin, y);
  y += 16;
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageW - margin, y);
  y += 22;

  heading("Your Skin Consultation", 18);
  body(analysis.summary);

  // Prominent disclaimer near the top so it's seen before the scores/preview.
  disclaimerBox();

  // Scores
  heading("Skin scores");
  analysis.categories.forEach((c) => {
    ensure(34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(33, 33, 33);
    doc.text(c.label, margin, y);
    doc.text(`${c.score}/100`, pageW - margin - 44, y);
    const barY = y + 4;
    doc.setFillColor(232, 232, 232);
    doc.rect(margin, barY, cw, 5, "F");
    doc.setFillColor(33, 33, 33);
    doc.rect(margin, barY, (cw * Math.max(0, Math.min(100, c.score))) / 100, 5, "F");
    y += 18;
    doc.setFontSize(9);
    doc.setTextColor(120, 110, 90);
    // Expectation / out-of-scope flag — mirrors the web report exactly. Reserve
    // room on the note's first line for a right-aligned pill.
    const expected = expectedImprovement(c);
    const noteWidth = expected ? cw - 150 : cw;
    const note = doc.splitTextToSize(c.note, noteWidth) as string[];
    ensure(note.length * 11 + 6);
    const noteY = y;
    doc.text(note, margin, noteY);
    if (expected) {
      const label =
        expected.kind === "consult"
          ? expected.label
          : expected.kind === "softened"
            ? `Lines ${expected.label}`
            : `Expected ${expected.label}`;
      const [bg, fg]: [[number, number, number], [number, number, number]] =
        expected.kind === "consult"
          ? [[247, 236, 219], [150, 101, 42]]
          : [[246, 239, 210], [138, 109, 31]];
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      const w = doc.getTextWidth(label) + 12;
      pill(label, pageW - margin - w, noteY - 9.5, bg, fg);
    }
    y += note.length * 11 + 12;
  });
  y += 4;

  // Before/after — labelled side-by-side composite (2:1).
  if (beforeAfter) {
    heading("Before & After — your treatment preview");
    const h = cw * 0.5;
    ensure(h + 4);
    doc.addImage(beforeAfter, "JPEG", margin, y, cw, h);
    y += h + 16;
  }

  // Assessment map (square)
  if (mapJpeg) {
    heading("Your assessment map");
    const size = Math.min(cw, 340);
    ensure(size + 4);
    doc.addImage(mapJpeg, "JPEG", margin, y, size, size);
    y += size + 16;
  }

  // Treatment-map breakdown — the per-area list the web report shows beside
  // the map (area, severity, concern, and the honest "Suggested:" note that
  // carries the out-of-scope consultation flag).
  if (analysis.annotations?.length) {
    const SEV_DOT: Record<string, [number, number, number]> = {
      low: [91, 185, 139],
      moderate: [107, 159, 164],
      notable: [224, 85, 111],
    };
    const SEV_LABEL: Record<string, string> = {
      low: "Minor",
      moderate: "Moderate",
      notable: "Notable",
    };
    heading("Where treatment works");
    const listX = margin + 22;
    const listW = cw - 22;
    analysis.annotations.forEach((a, i) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const areaLines = doc.splitTextToSize(a.area, listW - 60) as string[];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const concernLines = doc.splitTextToSize(a.concern, listW) as string[];
      doc.setFontSize(8.5);
      const sugLines = doc.splitTextToSize(
        `Suggested: ${a.treatment}`,
        listW,
      ) as string[];
      const rowH =
        areaLines.length * 12 +
        concernLines.length * 10 +
        sugLines.length * 10 +
        14;
      ensure(rowH);

      const rowTop = y;
      const [br, bg2, bb] = SEV_DOT[a.severity] ?? SEV_DOT.moderate;
      doc.setFillColor(br, bg2, bb);
      doc.circle(margin + 7, rowTop + 4, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(String(i + 1), margin + 7, rowTop + 6.6, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(33, 29, 22);
      doc.text(areaLines, listX, rowTop + 6);
      const areaW = doc.getTextWidth(areaLines[areaLines.length - 1] ?? a.area);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(150, 145, 130);
      doc.text(
        (SEV_LABEL[a.severity] ?? "").toUpperCase(),
        listX + areaW + 6,
        rowTop + 5.5,
      );
      y = rowTop + areaLines.length * 12 + 3;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90, 84, 72);
      doc.text(concernLines, listX, y);
      y += concernLines.length * 10 + 2;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(58, 122, 128);
      doc.text(sugLines, listX, y);
      y += sugLines.length * 10 + 10;
    });
    y += 4;
  }

  heading("How Aesthetics Central Clinic can help");
  body(analysis.veluriaRecommendation);

  // Repeat the prominent disclaimer at the end of the report.
  disclaimerBox();

  return doc;
}

/** Build the branded analysis PDF and trigger a browser download. */
export async function downloadAnalysisPdf(opts: AnalysisPdfOptions): Promise<void> {
  const doc = await buildAnalysisPdf(opts);
  doc.save("OD-Aesthetics-Skin-Consultation.pdf");
}

/**
 * Build the same branded analysis PDF and return it as base64 (no data: prefix),
 * ready to POST to /api/report for GoHighLevel delivery (upload + email).
 */
export async function analysisReportPdfBase64(
  opts: AnalysisPdfOptions,
): Promise<string> {
  const doc = await buildAnalysisPdf(opts);
  // "data:application/pdf;filename=…;base64,XXXX" → keep only the base64 tail.
  const dataUri = doc.output("datauristring");
  return dataUri.slice(dataUri.indexOf(",") + 1);
}
