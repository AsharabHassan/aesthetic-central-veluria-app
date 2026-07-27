"use client";

import { useEffect, useRef, useState } from "react";
import { cropRegion, loadImage, toSquare } from "@/lib/canvas";
import type { HeroZone } from "@/lib/hero";

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

/** Side of the crop window as a fraction of the frame. */
const WINDOW = 0.38;
/** Output resolution per panel. 1024 * 0.38 ≈ 389px of source, drawn at 2x. */
const OUT = 780;

const DOT: Record<string, string> = {
  notable: "bg-[#d4574b]",
  moderate: "bg-[#d9a441]",
  low: "bg-[#6fae5f]",
};

/**
 * One concern's before/after pair.
 *
 * Draws only once it is close to the viewport. Seven pairs is fourteen 780px
 * canvases, and painting them all on mount costs a visible stall on a mid-range
 * phone — on a page whose entire job is to survive being scrolled.
 */
function ZoomPair({
  before,
  after,
  zone,
  index,
  onReady,
}: {
  before: string;
  after: string;
  zone: HeroZone;
  index: number;
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
        const [b, a] = await Promise.all([loadImage(before), loadImage(after)]);
        if (cancelled) return;
        const pairs: [HTMLCanvasElement | null, HTMLImageElement][] = [
          [beforeRef.current, b],
          [afterRef.current, a],
        ];
        for (const [target, img] of pairs) {
          if (!target) continue;
          const crop = cropRegion(toSquare(img, 1024), zone.x, zone.y, WINDOW, OUT);
          target.width = OUT;
          target.height = OUT;
          const ctx = target.getContext("2d");
          ctx?.drawImage(crop, 0, 0);
        }
        onReady?.();
      } catch {
        // A crop failing must never take the results page down — the full-face
        // slider above already carries the result.
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Redraws when the sharper pass replaces the fast preview. Canvas redraw is
    // cheap, so this needs no extra state machinery.
  }, [near, before, after, zone.x, zone.y, onReady]);

  if (failed) return null;

  // Claude's treatment sentence usually opens by naming the product ("A course
  // of Veluria Ultra Lift can visibly firm…"), so prefixing it with the product
  // name unconditionally printed the name twice in one line. Prefix only when
  // the sentence does not already carry it.
  const namesProduct = zone.treatment
    .toLowerCase()
    .includes(zone.product.name.toLowerCase());

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
              DOT[zone.severity] ?? DOT.moderate
            }`}
          >
            {index + 1}
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
          { ref: beforeRef, label: "Now", dark: false },
          { ref: afterRef, label: "After Veluria", dark: true },
        ].map(({ ref, label, dark }) => (
          <figure key={label} className="relative">
            <canvas
              ref={ref}
              className="aspect-square w-full rounded-xl border border-white/70 bg-pearl-deep object-cover shadow-dew sm:rounded-2xl"
            />
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
  after,
  zones,
  onReady,
}: {
  before: string;
  after: string;
  zones: HeroZone[];
  /** Fired once the first pair has been drawn — used for the funnel event. */
  onReady?: () => void;
}) {
  if (zones.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="mb-4 text-center">
        <p className="eyebrow">Look closely</p>
        <h4 className="display mt-1 text-xl text-plum sm:text-2xl">
          Every area, side by side
        </h4>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-plum-soft">
          Each pair is the same square of your face, magnified from the two
          images above — nothing added, nothing retouched.
        </p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {zones.map((zone, i) => (
          <ZoomPair
            key={`${zone.area}-${i}`}
            before={before}
            after={after}
            zone={zone}
            index={i}
            onReady={i === 0 ? onReady : undefined}
          />
        ))}
      </div>
    </div>
  );
}
