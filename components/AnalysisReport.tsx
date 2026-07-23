"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SkinAnalysis } from "@/lib/types";
import AnnotatedFace from "./AnnotatedFace";
import BeforeAfterSlider from "./BeforeAfterSlider";
import AfterCallouts from "./AfterCallouts";
import ReviewsSlider, { REVIEW_COUNT } from "./ReviewsSlider";
import CaseStudy from "./CaseStudy";
import VeluriaRejuvenation from "./VeluriaRejuvenation";
import { expectedImprovement } from "@/lib/expectations";
import { planFor } from "@/lib/veluria";
import { DISCLAIMER_FULL } from "@/lib/legal";
import {
  composeBeforeAfter,
  downloadAnalysisPdf,
  downloadDataUrl,
} from "@/lib/download";

const BOOKING_URL =
  process.env.NEXT_PUBLIC_BOOKING_URL ?? "https://aestheticscentral.co.uk/";

// Booking destination for the free consultation CTA — Aesthetics Central's own
// GoHighLevel calendar for the free Veluria online consultation. Overridable via
// env for staging/testing. (The parent fork once defaulted to O.D.'s live
// calendar ID, which would have booked Luton leads into a Swindon diary — this
// is now Aesthetics Central's own link, so that risk is gone.)
const CALENDAR_URL =
  process.env.NEXT_PUBLIC_CALENDAR_URL ??
  "https://api.leadconnectorhq.com/widget/bookings/free-veluria-online-consultation";

function PhoneConsultButton({
  variant = "primary",
  className = "",
}: {
  variant?: "primary" | "ghost";
  className?: string;
}) {
  return (
    <a
      href={CALENDAR_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${variant === "primary" ? "btn-serum" : "btn-ghost"} ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
        <path
          d="M3 3.5C3 3 3.4 2.5 4 2.5h1.6c.4 0 .8.3.9.7l.6 2.2c.1.4 0 .8-.3 1l-1 .9c.7 1.4 1.8 2.5 3.2 3.2l.9-1c.2-.3.6-.4 1-.3l2.2.6c.4.1.7.5.7.9V13c0 .6-.5 1-1 1A10 10 0 0 1 3 3.5Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
      Book a Free Consultation
    </a>
  );
}

const PREVIEW_STEPS = [
  "Reading your skin map…",
  "Applying a realistic treatment outcome…",
  "Refining tone, texture & hydration…",
  "Finishing your before & after…",
];

function PreviewLoader({ before }: { before: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const pct = Math.min(95, Math.round(100 * (1 - Math.exp(-elapsed / 22))));
  const step =
    PREVIEW_STEPS[Math.min(Math.floor(elapsed / 14), PREVIEW_STEPS.length - 1)];

  return (
    <div className="relative aspect-[3/2] overflow-hidden rounded-[1.6rem] border border-white/70 bg-pearl-deep shadow-dew">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={before}
        alt="Your photo"
        className="h-full w-full scale-105 object-cover blur-md brightness-95"
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-plum-mute/40 to-transparent" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-white/40 px-8 text-center backdrop-blur-sm">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border border-plum/15" />
          <div className="absolute inset-0 animate-[spin_3s_linear_infinite] rounded-full border-2 border-transparent border-t-plum" />
        </div>
        <p className="text-sm tracking-wide text-plum">{step}</p>
        <div className="w-full max-w-xs">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/70">
            <div
              className="h-full rounded-full bg-plum transition-all duration-1000 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-[0.65rem] uppercase tracking-[0.15em] text-plum-soft">
            {pct}% · {elapsed}s
          </p>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E8E8E8]">
      <div
        className="h-full rounded-full bg-plum transition-all duration-700"
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
    </div>
  );
}

function SectionHead({
  index,
  eyebrow,
  title,
}: {
  index: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="mb-6 flex items-end gap-4">
      <span className="font-display text-4xl leading-none text-plum-mute/60">{index}</span>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3 className="display text-2xl text-plum sm:text-3xl">{title}</h3>
      </div>
    </div>
  );
}

function StickyPreviewBar({
  afterPending,
  after,
  previewRef,
}: {
  afterPending: boolean;
  after: string | null;
  previewRef: React.RefObject<HTMLElement | null>;
}) {
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolledPast(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [previewRef]);

  const scrollToPreview = () => {
    previewRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (!scrolledPast) return null;

  return (
    <div className="no-print fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/70 bg-white/80 px-5 py-3 backdrop-blur-xl shadow-[0_8px_32px_-10px_rgba(34,30,82,0.35)]">
        {afterPending ? (
          <>
            <span className="h-4 w-4 shrink-0 animate-[spin_1.5s_linear_infinite] rounded-full border-2 border-plum/20 border-t-plum" />
            <span className="text-sm text-plum">Generating your before &amp; after…</span>
          </>
        ) : after ? (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-plum">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 8.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-medium text-plum">Your before &amp; after is ready</span>
            <button
              onClick={scrollToPreview}
              className="ml-1 rounded-full bg-plum px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition hover:bg-plum-soft"
            >
              View ↑
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function AnalysisReport({
  before,
  after,
  afterPending,
  mapImage,
  mapPending,
  analysis,
  onRestart,
}: {
  before: string;
  after: string | null;
  afterPending: boolean;
  mapImage: string | null;
  mapPending: boolean;
  analysis: SkinAnalysis;
  onRestart: () => void;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const previewRef = useRef<HTMLElement>(null);

  // The same matcher the after-image prompt uses, run over the same concerns —
  // so the products named under the preview are exactly the ones allowed to
  // change the image above it.
  const previewPlan = planFor(
    (analysis.annotations ?? []).map((a) => ({
      area: a.area,
      concern: a.concern,
    })),
  );

  useEffect(() => setMounted(true), []);

  const handlePdf = async () => {
    setPdfBusy(true);
    try {
      await downloadAnalysisPdf({ analysis, before, after, map: mapImage });
    } finally {
      setPdfBusy(false);
    }
  };

  // The "before" is the real selfie and "after" is generated separately; for a
  // downloadable artifact we stitch them into one labelled side-by-side image.
  const handleDownloadBeforeAfter = async () => {
    if (!after) return;
    const composite = await composeBeforeAfter(before, after);
    downloadDataUrl(composite, "od-aesthetics-before-after.png");
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-14 pb-24">
      <div className="text-center animate-fade-scale">
        <p className="eyebrow">Your Consultation</p>
        <h2 className="display mt-4 text-4xl text-plum sm:text-6xl">
          Your skin, <span className="serum-text italic">at its best.</span>
        </h2>
      </div>

      {/* Prominent disclaimer at the TOP of the results, not just the footer. */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 text-left animate-fade-scale">
        <svg
          viewBox="0 0 24 24"
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
        <p className="text-xs font-medium leading-relaxed text-amber-900">
          {DISCLAIMER_FULL}
        </p>
      </div>

      {/* Before / After */}
      <section ref={previewRef} className="animate-fade-scale" style={{ animationDelay: "80ms" }}>
        <SectionHead index="01" eyebrow="Before & After" title="Your treatment preview" />
        {after ? (
          <div className="relative liquid-reveal">
            <div className="relative z-0 animate-reveal-blur">
              <AfterCallouts
                annotations={analysis.annotations}
                categories={analysis.categories}
              >
                <BeforeAfterSlider before={before} after={after} />
              </AfterCallouts>
            </div>
            <div className="sheen-line rounded-[1.6rem]" />
          </div>
        ) : afterPending ? (
          <PreviewLoader before={before} />
        ) : (
          <div className="overflow-hidden rounded-[1.6rem] border border-white/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={before} alt="Your photo" className="w-full" />
            <p className="bg-white/70 p-3 text-center text-xs text-plum-soft">
              We couldn&rsquo;t render your visual preview this time — your full
              analysis is below.
            </p>
          </div>
        )}
        {/*
          Name the plan against the image. The preview used to be captioned only
          with a disclaimer, so a client saw a better-looking face and was never
          told WHICH product produced it or how many sessions it takes — there
          was nothing concrete to book. The maintenance note is deliberate too:
          the DMAE evidence shows the effect is partially regressive once a
          course stops, which is an argument for a repeat course rather than a
          weakness to hide.
        */}
        {after && previewPlan.length > 0 && (
          <div className="mt-5 rounded-2xl border border-white/70 bg-white/55 p-4 text-center backdrop-blur-sm">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-plum-soft">
              This preview shows
            </p>
            <p className="mt-2 text-sm leading-relaxed text-plum">
              {previewPlan.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && (i === previewPlan.length - 1 ? " with " : ", ")}
                  <strong className="font-semibold">{p.name}</strong>
                  {" — "}
                  {p.sessions} sessions
                </span>
              ))}
              .
            </p>
            <p className="mt-2 text-xs leading-relaxed text-plum-soft">
              Results build over the course and are typically reviewed at twelve
              weeks. Bioremodelling is maintained with a top-up course, as the
              effect softens gradually once treatment stops.
            </p>
          </div>
        )}
        <p className="mt-4 text-center text-xs italic text-plum-mute">
          AI-simulated illustration of a possible outcome. Individual results vary
          and are not guaranteed. Not medical advice.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <PhoneConsultButton />
          <p className="text-xs text-plum-mute">
            Discuss your preview with our team — no cost, no obligation.
          </p>
        </div>
      </section>

      {/* Assessment map */}
      {(analysis.annotations?.length > 0 || mapPending || mapImage) && (
        <section className="animate-fade-scale" style={{ animationDelay: "120ms" }}>
          <SectionHead
            index="02"
            eyebrow="Where Treatment Works"
            title="Your treatment map"
          />
          <div className="relative">
            <AnnotatedFace
              image={after ?? before}
              annotations={analysis.annotations}
              mapImage={mapImage}
              mapPending={mapPending}
              onOpen={(src) => setLightbox(src)}
            />
          </div>
          <p className="mt-4 text-center text-xs italic text-plum-mute">
            Markers show areas identified for treatment, drawn on your simulated
            result. AI-estimated for guidance only — not a clinical diagnosis.
            A consultation with our team confirms the right plan for you.
          </p>
        </section>
      )}

      {/* Written analysis */}
      <section className="animate-fade-scale" style={{ animationDelay: "160ms" }}>
        <SectionHead index="03" eyebrow="In-Depth Analysis" title="What we see" />
        <div className="glass p-6 sm:p-8">
          <p className="leading-relaxed text-plum">{analysis.summary}</p>
          <div className="my-6 hairline" />
          <div className="space-y-5">
            {analysis.categories.map((c) => {
              const expected = expectedImprovement(c);
              return (
                <div key={c.label}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-sm font-medium text-plum">{c.label}</span>
                    <span className="font-display text-lg text-plum">
                      {c.score}
                      <span className="text-xs text-plum-mute">/100</span>
                    </span>
                  </div>
                  <ScoreBar score={c.score} />
                  <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-xs text-plum-soft">{c.note}</p>
                    {expected && (
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium ${
                          expected.kind === "consult"
                            ? "bg-[#F7ECDB] text-[#96652a]"
                            : "bg-[#F6EFD2] text-[#8a6d1f]"
                        }`}
                      >
                        {expected.kind === "consult"
                          ? expected.label
                          : expected.kind === "softened"
                            ? `Lines ${expected.label}`
                            : `Expected ${expected.label}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Veluria rejuvenation — how Veluria (at Aesthetics Central Clinic) helps this patient */}
      <section className="animate-fade-scale" style={{ animationDelay: "200ms" }}>
        <VeluriaRejuvenation
          categories={analysis.categories}
          cta={<PhoneConsultButton />}
        />
      </section>

      {/* Patient reviews — hidden until Aesthetics Central's own reviews are
          added to ReviewsSlider. The inherited list named real O.D. Aesthetics
          clients and was removed rather than re-attributed. */}
      {REVIEW_COUNT > 0 && (
        <section className="animate-fade-scale" style={{ animationDelay: "210ms" }}>
          <div className="mb-6 text-center">
            <p className="eyebrow">Loved by patients</p>
            <h3 className="display mt-2 text-3xl text-plum">What people say about Aesthetics Central Clinic</h3>
          </div>
          <ReviewsSlider />
        </section>
      )}

      {/* Case study: a real Aesthetics Central before & after.
          The CaseStudy component existed in the fork but was never rendered, so
          the owner-supplied before/after was invisible until now. */}
      <section className="animate-fade-scale" style={{ animationDelay: "212ms" }}>
        <div className="mb-6 text-center">
          <p className="eyebrow">Real Veluria results</p>
          <h3 className="display mt-2 text-3xl text-plum">
            Look at the Veluria before &amp; after
          </h3>
        </div>
        <CaseStudy />
        <div className="mt-6 flex justify-center">
          <PhoneConsultButton />
        </div>
      </section>

      {/* Save / open your analysis */}
      <section className="no-print animate-fade-scale" style={{ animationDelay: "220ms" }}>
        <div className="glass p-6 text-center sm:p-7">
          <p className="eyebrow">Keep your analysis</p>
          <h3 className="display mt-2 text-2xl text-plum">Open or download your report</h3>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button onClick={handlePdf} disabled={pdfBusy} className="btn-serum">
              {pdfBusy ? "Preparing PDF…" : "Download PDF"}
            </button>
            <button onClick={() => window.print()} className="btn-ghost">
              Open / print report
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-plum-soft">
            {after && (
              <button
                onClick={handleDownloadBeforeAfter}
                className="underline-offset-4 transition hover:text-plum hover:underline"
              >
                ↓ Before/After image
              </button>
            )}
            {mapImage && (
              <button
                onClick={() => downloadDataUrl(mapImage, "skin-assessment-map.png")}
                className="underline-offset-4 transition hover:text-plum hover:underline"
              >
                ↓ Assessment map image
              </button>
            )}
            <span className="text-plum-mute">Tip: tap any image to view it full-size</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center animate-fade-scale" style={{ animationDelay: "240ms" }}>
        <p className="eyebrow">Your next step</p>
        <h3 className="display mt-2 mb-6 text-3xl text-plum">
          Ready when you are
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <PhoneConsultButton />
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost">
            Explore treatments
          </a>
        </div>
        <button
          onClick={onRestart}
          className="no-print mt-5 block w-full text-sm text-plum-mute underline-offset-4 transition hover:text-plum hover:underline"
        >
          Start over
        </button>
        <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            Important
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-amber-900">
            {DISCLAIMER_FULL}
          </p>
        </div>
      </section>

      {/* Full-size image lightbox */}
      {lightbox && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-plum/80 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox}
              alt="Full-size analysis"
              className="max-h-[80vh] w-full rounded-2xl object-contain shadow-dew"
            />
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() =>
                  downloadDataUrl(
                    lightbox,
                    lightbox === mapImage
                      ? "skin-assessment-map.png"
                      : "od-aesthetics-before-after.png",
                  )
                }
                className="btn-serum"
              >
                Download image
              </button>
              <button onClick={() => setLightbox(null)} className="btn-ghost">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {mounted && createPortal(
        <StickyPreviewBar
          afterPending={afterPending}
          after={after}
          previewRef={previewRef}
        />,
        document.body,
      )}
    </div>
  );
}
