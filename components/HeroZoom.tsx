"use client";

import { useEffect, useRef, useState } from "react";
import { cropRegion, loadImage, toSquare } from "@/lib/canvas";
import type { HeroZone } from "@/lib/hero";

/**
 * The same square of the face, cut out of the before and the after and shown
 * side by side at 2x.
 *
 * WHY THIS EXISTS. The full-face slider is a bad instrument for the change this
 * app actually produces. It parks at 50%, which puts the LEFT half of the
 * original next to the RIGHT half of the result — two different parts of a
 * face, lit differently — and even swept end to end it asks the viewer to hold
 * a whole face in memory and diff it. Skin quality is a low-contrast,
 * distributed change; that is precisely the kind the eye cannot recover from
 * memory. Clients looked at a genuinely improved photo and said it looked the
 * same.
 *
 * A tight crop removes the memory step. The same square, twice, at 2x, a few
 * hundred pixels apart: the comparison happens in one fixation, and a change
 * too small to survive a whole-face sweep is obvious. It is the format every
 * clinic already uses on its wall, for the same reason.
 *
 * It is also the honest format. Nothing is re-rendered or re-graded here — both
 * panels are pixels straight from images the client can see in full above,
 * pulled from identical coordinates in identically-normalised frames. If the
 * treatment did nothing to this area, the crop shows that too.
 */

/** Side of the crop window as a fraction of the frame. */
const WINDOW = 0.38;
/** Output resolution per panel. 1024 * 0.38 ≈ 389px of source, drawn at 2x. */
const OUT = 780;

export default function HeroZoom({
  before,
  after,
  hero,
  onReady,
}: {
  before: string;
  after: string;
  hero: HeroZone;
  /** Fired once both panels have been drawn — used for the funnel event. */
  onReady?: () => void;
}) {
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
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
          const crop = cropRegion(
            toSquare(img, 1024),
            hero.x,
            hero.y,
            WINDOW,
            OUT,
          );
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
  }, [before, after, hero.x, hero.y, onReady]);

  if (failed) return null;

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="eyebrow">Look closely here</p>
          <h4 className="display mt-1 text-xl text-plum sm:text-2xl">
            {hero.area}
          </h4>
        </div>
        <span className="whitespace-nowrap rounded-full bg-[#E1EFF0] px-2.5 py-0.5 text-[0.7rem] font-medium text-[#3a7a80]">
          {hero.expectedLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {[
          { ref: beforeRef, label: "Before", dark: false },
          { ref: afterRef, label: "After", dark: true },
        ].map(({ ref, label, dark }) => (
          <figure key={label} className="relative">
            <canvas
              ref={ref}
              className="aspect-square w-full rounded-2xl border border-white/70 bg-pearl-deep object-cover shadow-dew"
            />
            <figcaption
              className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[0.55rem] uppercase tracking-[0.18em] backdrop-blur sm:left-3 sm:top-3 sm:text-[0.6rem] ${
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

      <p className="mt-3 text-center text-xs leading-relaxed text-plum-soft">
        The same area of your face, magnified from the two images above.{" "}
        <strong className="font-semibold text-plum">{hero.product.name}</strong>{" "}
        — {hero.product.sessions} sessions — is the product matched to this.
      </p>
    </div>
  );
}
