"use client";

import { useEffect, useRef, useState } from "react";
import { cropRegion, loadImage, toSquare } from "@/lib/canvas";
import { zoneWindowFor } from "@/lib/zoneCrop";
import { SEVERITY_DOT, type HeroZone } from "@/lib/hero";

/**
 * Every flagged area of the face, cut out of the before and the after and shown
 * side by side at 2x — one pair per concern.
 *
 * WHY THIS EXISTS. The full-face slider is a bad instrument for the change this
 * app produces. It parks at 50%, which puts the LEFT half of the original next
 * to the RIGHT half of the result — two different parts of a face, lit
 * differently — and even swept end to end it asks the viewer to hold a whole
 * face in memory and diff it. Skin quality is a low-contrast, distributed
 * change; that is precisely the kind the eye cannot recover from memory.
 * Clients looked at a genuinely improved photo and said it looked the same.
 *
 * A tight crop removes the memory step. The same square, twice, at 2x, a few
 * hundred pixels apart: the comparison happens in one fixation, and a change
 * too small to survive a whole-face sweep is obvious. It is the format every
 * clinic already uses on its wall, for the same reason.
 *
 * ONE CROP WAS NOT ENOUGH. This component replaces HeroZoom, which magnified
 * only the single worst area. That was the right idea stopped halfway: a client
 * told about six concerns saw their skin improve once and read about it five
 * more times, each time as a line of text with a small percentage beside it.
 * Six crops is six separate moments of "oh — that actually changed". Proof
 * accumulates; assertions do not.
 *
 * It is also the honest format. Nothing is re-rendered or re-graded here —
 * both panels are pixels straight from images the client can see in full above,
 * pulled from identical coordinates in identically-normalised frames. If the
 * treatment did nothing to an area, that area's crop shows that too.
 *
 * Out-of-scope concerns never reach this component: lib/hero.ts filters them
 * out through the same two gatekeepers the report and the image prompt use, so
 * an active breakout or a structural hollow can never acquire a crop that
 * implies we treated it.
 */

/**
 * Output resolution per panel. At the default window, 1024 * 0.38 ≈ 389px of
 * source drawn at 2x.
 *
 * The window itself is per-area and lives in lib/zoneCrop.ts, shared with the
 * zone route so a fallback crop frames an area exactly the way a generated one
 * does — see zoneWindowFor for why a flat window silently broke the jawline.
 */
const OUT = 780;

/**
 * One concern's before/after pair.
 *
 * Draws only once it is close to the viewport. Seven pairs is fourteen 780px
 * canvases, and painting them all on mount costs a visible stall on a mid-range
 * phone — on a page whose entire job is to survive being scrolled.
 */
function ZoomPair({
  before,
  pair,
  zone,
  index,
  settled,
  onReady,
}: {
  before: string;
  /**
   * This zone's own generated close-up, once it has one. Both panels come from
   * the server already cut to the same square (see app/api/zone/route.ts), so
   * they are drawn straight in rather than cropped here.
   */
  pair?: { before: string; after: string };
  zone: HeroZone;
  index: number;
  /** True once every zone has finished, so a missing pair means failed. */
  settled: boolean;
  onReady?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(index === 0);
  const [failed, setFailed] = useState(false);

  // The first pair is drawn eagerly — it sits directly under the slider and is
  // usually already on screen, so waiting for an intersection would show an
  // empty box at exactly the moment the client is looking at it.
  useEffect(() => {
    if (near) return;
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    (async () => {
      try {
        // THE BEFORE PANEL IS DRAWN IMMEDIATELY, from the client's own photo,
        // using the SAME crop geometry the server uses (lib/zoneCrop.ts is
        // shared for exactly this). So the left-hand side is real from the
        // first frame and only the right-hand side is waiting — a far better
        // loading state than a blurred whole face, and it costs nothing.
        //
        // When the server's pair lands its own before crop replaces this one,
        // because registration between the two panels is the single thing a
        // side-by-side comparison cannot be allowed to get wrong.
        const b = await loadImage(pair ? pair.before : before);
        if (cancelled) return;
        const bt = beforeRef.current;
        if (bt) {
          bt.width = OUT;
          bt.height = OUT;
          const ctx = bt.getContext("2d");
          if (ctx) {
            ctx.imageSmoothingQuality = "high";
            if (pair) {
              ctx.drawImage(b, 0, 0, OUT, OUT);
            } else {
              ctx.drawImage(
                cropRegion(
                  toSquare(b, 1024),
                  zone.x,
                  zone.y,
                  zoneWindowFor(zone.area, zone.concern),
                  OUT,
                ),
                0,
                0,
              );
            }
          }
        }

        if (!pair) return;
        const a = await loadImage(pair.after);
        if (cancelled) return;
        const at = afterRef.current;
        if (at) {
          at.width = OUT;
          at.height = OUT;
          const ctx = at.getContext("2d");
          if (ctx) {
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(a, 0, 0, OUT, OUT);
          }
        }
        onReady?.();
      } catch {
        // A card failing must never take the results page down. The rest of the
        // reel, the written analysis and the real case study all still stand.
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Redraws when this zone's generated pair arrives. Canvas redraw is cheap,
    // so this needs no extra state machinery.
  }, [near, before, pair, zone.x, zone.y, zone.area, zone.concern, onReady]);

  if (failed) return null;

  // Claude's treatment sentence usually opens by naming a product ("A course of
  // Veluria Ultra Lift can visibly soften…"), so prefixing it with the matched
  // product name printed a name twice in one line.
  //
  // Worse, it could print two DIFFERENT names. This used to check only whether
  // the sentence named THIS zone's matched product, and productFor routes
  // forehead lines to Silk Skin while Claude — correctly, per the analysis
  // prompt — recommends Ultra Lift for them. The card then rendered "Veluria
  // Silk Skin — A course of Veluria Ultra Lift can…", contradicting itself in
  // one line on the most persuasive element of the page.
  //
  // Now: if the sentence names ANY Veluria product it speaks for itself and no
  // prefix is added. The underlying routing disagreement still exists in
  // productFor — worth fixing, but that changes which product a client is
  // recommended, which is a clinical call rather than a display one.
  const namesProduct = /veluria\s+(silk\s*skin|ultra\s*lift|pearl\s*tone)/i.test(
    zone.treatment,
  );

  return (
    <div
      ref={wrapRef}
      className="rounded-[1.4rem] border border-white/60 bg-white/45 p-3 backdrop-blur-sm sm:p-4"
    >
      {/*
        Column on mobile, row from `sm` up. A wrapping flex row put the badge
        beside short area names and under long ones, so the reel's numbers
        landed in a different place on almost every card. Stacking deliberately
        below the small breakpoint keeps them in one column the eye can run down.
      */}
      <div className="mb-3 flex flex-col items-start gap-1.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-3">
        <div className="flex min-w-0 max-w-full items-center gap-2.5">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold text-white ${
              SEVERITY_DOT[zone.severity] ?? SEVERITY_DOT.moderate
            }`}
          >
            {zone.index}
          </span>
          <h4 className="min-w-0 text-sm font-semibold leading-tight text-plum sm:text-base">
            {zone.area}
          </h4>
        </div>
        <span className="ml-8 whitespace-nowrap rounded-full bg-[#E1EFF0] px-2.5 py-0.5 text-[0.75rem] font-semibold text-[#3a7a80] sm:ml-0">
          {zone.expectedLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {[
          { ref: beforeRef, label: "Now", dark: false, isAfter: false },
          { ref: afterRef, label: "After Veluria", dark: true, isAfter: true },
        ].map(({ ref, label, dark, isAfter }) => (
          <figure key={label} className="relative">
            <canvas
              ref={ref}
              className="aspect-square w-full rounded-xl border border-white/70 bg-pearl-deep object-cover shadow-dew sm:rounded-2xl"
            />
            {/*
              THE AFTER PANEL MUST NEVER BE A BLANK WHITE BOX.
              The card reserves its slot the moment the analysis lands so the
              page does not jump as results arrive — but the right-hand canvas
              has nothing painted on it until that zone's generation returns,
              and an empty white square next to a photograph does not read as
              "loading", it reads as broken. This is what the client saw.
            */}
            {isAfter && !pair && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-pearl-deep sm:rounded-2xl">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                <span className="relative h-6 w-6 animate-[spin_1.6s_linear_infinite] rounded-full border-2 border-plum/15 border-t-plum/70" />
                <span className="relative px-3 text-center text-[0.6rem] uppercase tracking-[0.14em] text-plum-soft">
                  Simulating
                </span>
              </div>
            )}
            <figcaption
              className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[0.5rem] uppercase tracking-[0.14em] backdrop-blur sm:left-2.5 sm:top-2.5 sm:px-2.5 sm:py-1 sm:text-[0.6rem] sm:tracking-[0.18em] ${
                dark
                  ? "border border-white/40 bg-plum text-white shadow-sm"
                  : "border border-white/50 bg-white/70 text-plum"
              }`}
            >
              {label}
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-plum-soft">
        {!namesProduct && (
          <>
            <strong className="font-semibold text-plum">
              {zone.product.name}
            </strong>{" "}
            —{" "}
          </>
        )}
        {zone.treatment}
      </p>
    </div>
  );
}

export default function ConcernZooms({
  before,
  zones,
  zoneImages,
  zonePending,
  onReady,
  onVisible,
}: {
  before: string;
  /** The zones we are generating — a card is reserved for each up front. */
  zones: HeroZone[];
  /** Per-area generated close-ups, keyed `area|concern`. */
  zoneImages?: Record<string, { before: string; after: string }>;
  zonePending?: boolean;
  /** Fired once the first pair has been drawn — used for the funnel event. */
  onReady?: () => void;
  /** Fired when the reel first enters the viewport. */
  onVisible?: () => void;
}) {
  const generated = zoneImages ?? {};
  const settled = !zonePending;
  const wrapRef = useRef<HTMLDivElement>(null);
  const seen = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || seen.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !seen.current) {
          seen.current = true;
          onVisible?.();
          io.disconnect();
        }
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onVisible]);

  // SLOTS ARE RESERVED, NOT FILTERED IN.
  //
  // This used to render only the zones that had already come back, so cards
  // appeared under the reader's thumb as each generation landed and the page
  // jumped while they were scrolling it. Every zone we asked for gets its card
  // immediately — real header, real before panel — and only the right-hand side
  // waits.
  //
  // A zone that never arrives is dropped ONLY once everything has settled, so
  // the removal happens off-screen rather than mid-scroll. A pair whose "after"
  // is indistinguishable is worse than no card at all: it teaches the client
  // that the other cards are fake too, which is why /api/zone would rather
  // return nothing than return a dud.
  const visible = settled
    ? zones.filter((z) => generated[`${z.area}|${z.concern}`])
    : zones;

  if (visible.length === 0) return null;

  const ready = zones.filter((z) => generated[`${z.area}|${z.concern}`]).length;

  return (
    <div ref={wrapRef} className="mt-8">
      <div className="mb-4 text-center">
        <p className="eyebrow">Look closely</p>
        <h4 className="display mt-1 text-xl text-plum sm:text-2xl">
          Every area, side by side
        </h4>
        {/*
          This line used to read "magnified from the two images above — nothing
          added, nothing retouched", which was true while both panels were crops
          of images shown in full higher up the page. The right-hand panel is now
          its own simulation, so that wording would be a false claim about how
          the picture was made — on the most persuasive element on the page.
        */}
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-plum-soft">
          On the left, your own photo. On the right, a simulation of how this
          area could look after a course of treatment — not a guaranteed result.
        </p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {visible.map((zone, i) => (
          <ZoomPair
            key={`${zone.area}-${zone.index}`}
            before={before}
            pair={generated[`${zone.area}|${zone.concern}`]}
            zone={zone}
            index={i}
            settled={settled}
            onReady={i === 0 ? onReady : undefined}
          />
        ))}
        {zonePending && (
          <p className="pt-1 text-center text-xs text-plum-soft">
            {ready} of {zones.length} ready…
          </p>
        )}
      </div>
    </div>
  );
}
