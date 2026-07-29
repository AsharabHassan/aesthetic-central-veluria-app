"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SkinAnalysis } from "@/lib/types";
import AnnotatedFace from "./AnnotatedFace";
import BeforeAfterSlider from "./BeforeAfterSlider";
import AfterCallouts from "./AfterCallouts";
import ConcernZooms from "./ConcernZooms";
import ScoreDestination from "./ScoreDestination";
import VeluriaStack from "./VeluriaStack";
import ReviewsSlider, { REVIEW_COUNT } from "./ReviewsSlider";
import CaseStudy from "./CaseStudy";
import VeluriaRejuvenation from "./VeluriaRejuvenation";
import { bookingUrl, planSummary, type CtaPlacement } from "@/lib/booking";
import { expectedImprovement } from "@/lib/expectations";
import { canonicalAnnotations, concernZones, type HeroZone } from "@/lib/hero";
import { track, trackServer } from "@/lib/meta";
import { planFor } from "@/lib/veluria";
import { DISCLAIMER_FULL } from "@/lib/legal";
import {
  composeZoneReel,
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

/**
 * The ask.
 *
 * The label is a PROP with no safe default sentence, because the copy is the
 * point. Every CTA on this page used to read "Free Online Phone Consultation",
 * which describes the format of the call and gives no reason to take it. The
 * client has just been shown where their skin can get to; the button should
 * name that, and each placement names the thing the client is looking at when
 * they reach it.
 */
function PhoneConsultButton({
  variant = "primary",
  className = "",
  href = CALENDAR_URL,
  label = "Book your free consultation",
  onClick,
}: {
  variant?: "primary" | "ghost";
  className?: string;
  /** Built by lib/booking.ts so the matched plan travels with the click. */
  href?: string;
  label?: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
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
      {label}
    </a>
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

/**
 * The persistent bar at the foot of the viewport, and the single biggest change
 * to how hard this page asks.
 *
 * IT USED TO STOP BEING USEFUL. It had exactly one job: announce that the
 * before/after had finished rendering and offer to scroll back up to it. Once
 * the client had seen the preview it kept saying the same thing, so for the
 * entire rest of the report — the crops, the analysis, the case study, the
 * reviews, all the evidence — the only way to book was to happen to scroll past
 * one of four static buttons.
 *
 * Now it converts. Before the preview is seen it does what it always did; after
 * that it becomes a booking CTA and stays on screen the whole way down. Same
 * bar, same footprint, and the ask is continuously available rather than
 * available four times.
 */
function StickyCta({
  zonePending,
  shown,
  reelRef,
  seenReel,
  href,
  onBook,
}: {
  zonePending: boolean;
  /** How many close-ups have actually landed. */
  shown: number;
  reelRef: React.RefObject<HTMLElement | null>;
  /** True once the reel section has been on screen at least once. */
  seenReel: boolean;
  href: string;
  onBook: () => void;
}) {
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    const el = reelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolledPast(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reelRef]);

  const scrollToReel = () => {
    reelRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (!scrolledPast) return null;

  return (
    <div className="no-print fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-full border border-white/70 bg-white/85 px-4 py-2.5 backdrop-blur-xl shadow-[0_8px_32px_-10px_rgba(34,30,82,0.35)] sm:gap-3 sm:px-5 sm:py-3">
        {zonePending && shown === 0 ? (
          <>
            <span className="h-4 w-4 shrink-0 animate-[spin_1.5s_linear_infinite] rounded-full border-2 border-plum/20 border-t-plum" />
            <span className="text-sm text-plum">Preparing your close-ups…</span>
          </>
        ) : shown > 0 && !seenReel ? (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-plum">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 8.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-medium text-plum">Your close-ups are ready</span>
            <button
              onClick={scrollToReel}
              className="ml-1 shrink-0 rounded-full bg-plum px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition hover:bg-plum-soft"
            >
              View ↑
            </button>
          </>
        ) : (
          <>
            {/*
              The line shortens rather than wraps below 400px: a two-line sticky
              bar eats a real share of a small viewport, which is the opposite
              of what a persistent CTA is for.
            */}
            <span className="hidden text-sm font-medium text-plum sm:inline">
              Talk it through with our team
            </span>
            <a
              href={href}
              onClick={onBook}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 whitespace-nowrap rounded-full bg-plum px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-plum-soft sm:px-5"
            >
              Book free consultation
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function AnalysisReport({
  before,
  mapImage,
  mapPending,
  previewImage,
  previewPending,
  previewFailed,
  zoneTargets,
  zoneImages,
  zonePending,
  hero,
  analysis,
  email,
  name,
  onRestart,
}: {
  before: string;
  mapImage: string | null;
  mapPending: boolean;
  /**
   * The full-face "after" — the generated close-ups composited back onto the
   * client's own photograph, plus the deterministic skin grade as a guaranteed
   * floor. Not a single full-face generation: see lib/compose.ts for why that
   * measurably changes nothing and why assembling from close-ups does.
   */
  previewImage?: string | null;
  previewPending?: boolean;
  /** The pass finished and produced nothing — show that, never a blank gap. */
  previewFailed?: boolean;
  /**
   * The zones we are generating, published as soon as the analysis lands. The
   * reel reserves a card for each so nothing pops into the page mid-scroll.
   */
  zoneTargets?: HeroZone[];
  /** Per-area close-ups generated on their own crops, keyed `area|concern`. */
  zoneImages?: Record<string, { before: string; after: string }>;
  zonePending?: boolean;
  /** The single area the preview leads on — see lib/hero.ts. */
  hero?: HeroZone | null;
  analysis: SkinAnalysis;
  /** Aesthetics Central has no CRM yet, so these are optional: without an
   *  email the funnel events fire to the pixel only and skip the server. */
  email?: string | null;
  name?: string | null;
  onRestart: () => void;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const reelRef = useRef<HTMLElement>(null);

  // THE canonical concern list — de-duplicated, worst first, numbered once.
  // Every list on this page derives from it, so the callout rows, the reel and
  // the treatment map can no longer disagree about which areas exist, what
  // order they are in, or what number each one carries. See lib/hero.ts.
  const concerns = canonicalAnnotations(analysis.annotations);

  const concernList = concerns.map((a) => ({
    area: a.area,
    concern: a.concern,
  }));
  // planFor, NOT programmeFor. `programmeFor` widens the product list using the
  // category scores, but only the products a concern actually matched get to
  // change a picture — so naming the wider list would caption the close-ups
  // with a product whose effect was never applied to them.
  const programme = planFor(concernList);

  // Every in-scope area, worst first. Out-of-scope concerns are filtered out by
  // lib/hero.ts, so nothing here can imply we treat something we do not.
  const allZones = concernZones(analysis.annotations, analysis.categories);
  // The reel renders the zones we actually asked for, so a card exists (header,
  // real before panel, shimmering after) from the moment the analysis lands.
  // Before the fan-out publishes them, fall back to the full list.
  const reelZones = zoneTargets && zoneTargets.length > 0 ? zoneTargets : allZones;
  // How many close-ups actually made it onto the page. Drives the peak-proof CTA
  // and the product caption: a zone whose generation failed, or which did not
  // clear the visible-change floor in /api/zone, must not be spoken about.
  const shownZones = reelZones.filter(
    (z) => zoneImages?.[`${z.area}|${z.concern}`],
  );
  const shownProgramme = planFor(
    shownZones.map((z) => ({ area: z.area, concern: z.concern })),
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  // Sits directly below the reel: reaching it means the client has actually
  // scrolled past the proof, not merely arrived at the section containing it.
  const reelSeenRef = useRef<HTMLDivElement>(null);
  // Drives the sticky bar's switch from "your preview is ready" to the booking
  // CTA: once they have actually seen the preview, telling them it exists is
  // wasted space and the ask should take it.
  const [seenReel, setSeenReel] = useState(false);
  // Every funnel event fires at most once per report. Without this, the
  // observers below would re-fire on each scroll past and the counts would
  // measure scrolling rather than reach.
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => setMounted(true), []);

  const planText = planSummary(programme);

  /** Browser pixel + CRM timeline, once each. */
  const fire = useCallback(
    (event: string, detail: Record<string, string> = {}, standard = false) => {
      if (fired.current.has(event)) return;
      fired.current.add(event);
      track(event, { plan: planText, focus: hero?.area ?? "", ...detail }, standard);
      trackServer(email, event, { plan: planText, focus: hero?.area ?? "", ...detail });
    },
    [email, planText, hero?.area],
  );

  const ctaHref = (placement: CtaPlacement) =>
    bookingUrl(CALENDAR_URL, {
      plan: programme,
      hero,
      name,
      email,
      placement,
    });

  /**
   * A CTA click is the one event allowed to fire more than once per report:
   * `fired` is keyed by event name, so a second click from a different part of
   * the page would otherwise be swallowed and we would lose the placement
   * comparison that the utm_content param exists to answer.
   */
  const onBookingClick = (placement: CtaPlacement) => () => {
    track("Schedule", { plan: planText, focus: hero?.area ?? "", placement }, true);
    trackServer(email, "BookingClicked", {
      plan: planText,
      focus: hero?.area ?? "",
      placement,
    });
  };

  /*
    Reach events: did they get to the preview, the crops, the end of the report.

    THRESHOLD 0, AND THAT IS A BUG FIX, not a loosening. These observers ran at
    `threshold: 0.4`, which asks for 40% of the TARGET's own area to be visible
    — and the preview section is several thousand pixels tall. Forty percent of
    it cannot fit in any phone viewport, so the ratio was mathematically
    incapable of reaching 0.4 and `PreviewViewed` never fired at all. The funnel
    numbers this page was rebuilt to produce were counting nothing.

    The targets are now zero-height sentinels sitting at the point each event
    means, so "intersecting at all" is exactly the right question.
  */
  useEffect(() => {
    const targets: [React.RefObject<HTMLElement | null>, string][] = [
      [reelSeenRef, "ReelViewed"],
      [bottomRef, "ReportCompleted"],
    ];
    const observers = targets.map(([ref, event]) => {
      const el = ref.current;
      if (!el) return null;
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            fire(event);
            if (ref === reelSeenRef) setSeenReel(true);
            io.disconnect();
          }
        },
        { threshold: 0 },
      );
      io.observe(el);
      return io;
    });
    return () => observers.forEach((io) => io?.disconnect());
    // Re-runs when the first close-up lands, because the sentinel below the reel
    // does not exist in the DOM until the section has something to sit under.
  }, [fire, shownZones.length]);

  const handlePdf = async () => {
    setPdfBusy(true);
    try {
      await downloadAnalysisPdf({
        analysis,
        before,
        zonePairs: shownZones.map((z) => ({
          zone: z,
          pair: zoneImages![`${z.area}|${z.concern}`],
        })),
        map: mapImage,
      });
    } finally {
      setPdfBusy(false);
    }
  };

  // One labelled sheet of every close-up that made it onto the page — the
  // shareable artifact, now that there is no single full-face pair to stitch.
  const handleDownloadCloseUps = async () => {
    if (shownZones.length === 0) return;
    const sheet = await composeZoneReel(
      shownZones.map((z) => ({
        area: z.area,
        ...zoneImages![`${z.area}|${z.concern}`],
      })),
    );
    downloadDataUrl(sheet, "aesthetics-central-close-ups.png");
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

      {/*
        The headline number and the first ask, above everything else.

        A meaningful share of clients never scroll as far as the preview, and
        until now the page gave those people nothing to act on — the first CTA
        sat below a generated image that can take a minute to arrive. This block
        needs no image and renders the moment the analysis lands.
      */}
      <section className="animate-fade-scale" style={{ animationDelay: "60ms" }}>
        <ScoreDestination
          categories={analysis.categories}
          cta={
            <>
              <PhoneConsultButton
                href={ctaHref("score")}
                onClick={onBookingClick("score")}
                label="Book your free consultation"
              />
              <p className="text-xs text-plum-mute">
                15 minutes with our team — no cost, no obligation.
              </p>
            </>
          }
        />
      </section>

      {/*
        SECTION 01 — the close-up reel, and it is now the whole visual proof.

        This slot used to hold a full-face before/after slider. It was removed
        on measurement, not taste: `images.edit` re-renders the entire frame, so
        at full-face scale any one area is a few hundred pixels and comes back
        retextured rather than changed. The jaw moved a mean absolute ~11 across
        three prompt variants and looked identical every time; the same region
        generated on its own crop moved 29.7 and looked genuinely different.

        The reel also solves what the slider never could: a slider parks at 50%,
        putting the LEFT half of one face beside the RIGHT half of another, and
        even swept it asks the viewer to diff a whole face from memory. A tight
        pair, side by side, is one fixation.
      */}
      <section ref={reelRef} className="animate-fade-scale" style={{ animationDelay: "80ms" }}>
        <SectionHead index="01" eyebrow="Before & After" title="Your treatment preview" />

        {/*
          THE SLIDER, THIRD TIME — and the difference is where the "after" comes
          from. The first two attempts fed it a full-face generation and then a
          landmark warp, and both failed for the same reason: neither put a
          visible change on the AREAS THE CLIENT WAS TOLD ABOUT. A generation
          smears a faint change over the whole face; a warp moves only the jaw.
          Either way a slider parked at 50% shows nothing worth looking at.

          This "after" is the close-ups themselves, composited back onto the
          client's own photograph and masked to the skin of the face. So the
          change is exactly where the report says it is, it is as strong as the
          close-ups are, and every pixel outside the face is untouched — which
          is what makes the two halves genuinely the same photograph.
        */}
        {previewImage ? (
          <div className="relative liquid-reveal">
            <div className="relative z-0 animate-reveal-blur">
              <BeforeAfterSlider
                before={before}
                after={previewImage}
                onDrag={() => fire("SliderDragged")}
              />
            </div>
            <div className="sheen-line rounded-[1.6rem]" />
          </div>
        ) : previewPending ? (
          <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[1.6rem] border border-white/70 bg-pearl-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={before} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-40 blur-sm" />
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            <div className="relative flex flex-col items-center gap-3">
              <span className="h-8 w-8 animate-[spin_1.6s_linear_infinite] rounded-full border-2 border-plum/20 border-t-plum" />
              <p className="text-sm text-plum-soft">Building your preview…</p>
            </div>
          </div>
        ) : previewFailed ? (
          /*
            NEVER AN EMPTY GAP. This branch was `null`, so when the full-face
            pass failed the section simply had nothing in it — no image, no
            spinner, no message. The owner opened the page, saw blank space
            where the before/after belonged, and reasonably concluded the whole
            feature was gone. A page that admits it could not build the preview
            is worth far more than one that quietly omits it.
          */
          <div className="relative flex aspect-square w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[1.6rem] border border-white/70 bg-pearl-deep px-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={before}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover opacity-30 blur-sm"
            />
            <p className="relative text-sm font-medium text-plum">
              We couldn&rsquo;t build your full-face preview from this photo.
            </p>
            <p className="relative text-xs text-plum-soft">
              Your close-ups below are unaffected. A brighter photo taken facing
              a window usually fixes this.
            </p>
          </div>
        ) : null}

        {previewImage && (
          <p className="mt-3 text-center text-xs italic text-plum-mute">
            A simulation of a possible outcome, shown on your own photo.
            Individual results vary and are not guaranteed. Not medical advice.
          </p>
        )}

        <div className="mt-10">
          <SectionHead index="02" eyebrow="Look closely" title="Your close-ups" />
        </div>

        <ConcernZooms
          before={before}
          zones={reelZones}
          zoneImages={zoneImages}
          zonePending={zonePending}
          onReady={() => fire("ConcernZoomsReady")}
          onVisible={() => fire("ConcernZoomsViewed")}
        />

        {/*
          Nothing cleared the visible-change floor. Say so plainly rather than
          leaving an empty section or, worse, showing pairs that look identical
          — /api/zone would rather return nothing than return a dud, and the
          page has to honour that. The written analysis below and the real
          client result further down both still stand on their own.
        */}
        {!zonePending && shownZones.length === 0 && (
          <div className="rounded-2xl border border-white/70 bg-white/55 p-5 text-center backdrop-blur-sm">
            <p className="text-sm leading-relaxed text-plum">
              We couldn&rsquo;t produce a close-up preview we&rsquo;re happy with
              from this photo.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-plum-soft">
              Your full skin analysis is below, and a brighter, front-on photo in
              daylight usually gives us much more to work with.
            </p>
          </div>
        )}

        {/* Reach sentinel: they have scrolled past the proof. */}
        <div ref={reelSeenRef} aria-hidden="true" className="h-px w-full" />

        {/*
          Peak proof. They have just watched every flagged area improve one at a
          time; this is the moment the ask is worth the most.
        */}
        {shownZones.length > 0 && (
          <div className="mt-7 flex flex-col items-center gap-2">
            <PhoneConsultButton
              href={ctaHref("hero-zoom")}
              onClick={onBookingClick("hero-zoom")}
              label="Get this result — book free"
            />
            <p className="text-xs text-plum-mute">
              Our team will confirm what your skin needs to get there.
            </p>
          </div>
        )}

        {/*
          Every flagged area, including the ones Veluria cannot treat.
          Deliberately BELOW the reel: it is instantly-available text, so it
          gives the client something real to read while the close-ups generate,
          without pushing the proof itself down the page.

          It is also the page's claim-discipline safety net — the only list that
          names out-of-scope concerns with the amber "Beyond Veluria" pill, and
          by construction those never acquire a picture.
        */}
        <AfterCallouts concerns={concerns} categories={analysis.categories} />

        {/*
          Name the plan against the pictures. Derived from the zones that
          actually SURVIVED, not from every annotation: a card can be dropped
          when its generation does not clear the floor, and naming a product
          whose close-up was never shown would caption a result that is not on
          the page.
        */}
        {shownProgramme.length > 0 && (
          <div className="mt-5 rounded-2xl border border-white/70 bg-white/55 p-4 text-center backdrop-blur-sm">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-plum-soft">
              These close-ups show
            </p>
            <p className="mt-2 text-sm leading-relaxed text-plum">
              {shownProgramme.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && (i === shownProgramme.length - 1 ? " with " : ", ")}
                  <strong className="font-semibold">{p.name}</strong>
                </span>
              ))}
              {" — "}the Veluria your skin matched, at the end of a full
              programme.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-plum-soft">
              How much of it you need, and over what period, is for our team to
              advise at your consultation.
            </p>
          </div>
        )}
        <p className="mt-4 text-center text-xs italic text-plum-mute">
          AI-simulated illustration of a possible outcome. Individual results vary
          and are not guaranteed. Not medical advice.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <PhoneConsultButton
            href={ctaHref("preview")}
            onClick={onBookingClick("preview")}
            label="Discuss these with our team"
          />
          <p className="text-xs text-plum-mute">
            No cost, no obligation.
          </p>
        </div>
      </section>

      {/* Why the result above takes more than one product. */}
      {programme.length > 0 && (
        <section className="animate-fade-scale" style={{ animationDelay: "100ms" }}>
          <VeluriaStack
            programme={programme}
            cta={
              <PhoneConsultButton
                href={ctaHref("stack")}
                onClick={onBookingClick("stack")}
                label="Book your free consultation"
              />
            }
          />
        </section>
      )}

      {/* Assessment map */}
      {(analysis.annotations?.length > 0 || mapPending || mapImage) && (
        <section className="animate-fade-scale" style={{ animationDelay: "120ms" }}>
          <SectionHead
            index="03"
            eyebrow="Where Treatment Works"
            title="Your treatment map"
          />
          <div className="relative">
            <AnnotatedFace
              image={before}
              concerns={concerns}
              mapImage={mapImage}
              mapPending={mapPending}
              onOpen={(src) => setLightbox(src)}
            />
          </div>
          <p className="mt-4 text-center text-xs italic text-plum-mute">
            Markers show areas identified for treatment, drawn on your own
            photo. AI-estimated for guidance only — not a clinical diagnosis.
            A consultation with our team confirms the right plan for you.
          </p>
        </section>
      )}

      {/* Written analysis */}
      <section className="animate-fade-scale" style={{ animationDelay: "160ms" }}>
        <SectionHead index="04" eyebrow="In-Depth Analysis" title="What we see" />
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
                        {expected.label}
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
          cta={
            <PhoneConsultButton
              href={ctaHref("rejuvenation")}
              onClick={onBookingClick("rejuvenation")}
              label="Book your free consultation"
            />
          }
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
          <PhoneConsultButton
            href={ctaHref("case-study")}
            onClick={onBookingClick("case-study")}
            label="Start with a free consultation"
          />
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
            {shownZones.length > 0 && (
              <button
                onClick={handleDownloadCloseUps}
                className="underline-offset-4 transition hover:text-plum hover:underline"
              >
                ↓ Download your close-ups
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

      {/*
        The close. It restates the destination rather than announcing that a
        page has ended — someone who has read this far has the evidence and
        needs the reason, not a sign-off.
      */}
      <section className="text-center animate-fade-scale" style={{ animationDelay: "240ms" }}>
        <div className="glass p-7 sm:p-9">
          <p className="eyebrow">Your next step</p>
          <h3 className="display mt-2 text-3xl text-plum sm:text-4xl">
            That result starts with{" "}
            <span className="serum-text italic">a conversation</span>
          </h3>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-plum-soft">
            You have seen where your skin can get to and which part of the
            Veluria range it matched. What it actually takes to get you there is
            for our team to work out with you — and that costs nothing to find
            out.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <PhoneConsultButton
              href={ctaHref("footer")}
              onClick={onBookingClick("footer")}
              label="Book your free consultation"
            />
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              Explore treatments
            </a>
          </div>
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

      {/* Reach sentinel: they got to the end of the report. */}
      <div ref={bottomRef} aria-hidden="true" className="h-px w-full" />

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
                      : "aesthetics-central-close-ups.png",
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
        <StickyCta
          zonePending={zonePending ?? false}
          shown={shownZones.length}
          reelRef={reelRef}
          seenReel={seenReel}
          href={ctaHref("sticky")}
          onBook={onBookingClick("sticky")}
        />,
        document.body,
      )}
    </div>
  );
}
