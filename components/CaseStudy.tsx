"use client";

import { useCallback, useRef, useState } from "react";

const BEFORE_SRC = "/assets/case-studies/facial-rejuvenation-before.webp";
const AFTER_SRC = "/assets/case-studies/facial-rejuvenation-after.webp";

/** Portrait (9:16) draggable before/after comparison, tuned for case-study photos. */
function PortraitCompare({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    containerRef.current?.setPointerCapture(e.pointerId);
    move(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) move(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      ref={containerRef}
      className="relative mx-auto aspect-[9/16] w-full max-w-[300px] cursor-ew-resize touch-none select-none overflow-hidden rounded-[1.4rem] border border-white/70 bg-pearl-deep shadow-dew sm:max-w-[340px]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* After (full background) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={after}
        alt="Facial rejuvenation — after"
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {/* Before (full-size, revealed via clip-path — no reflow, GPU-smooth) */}
      <div
        className="absolute inset-0 will-change-[clip-path]"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before}
          alt="Before treatment"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <span className="absolute left-3 top-3 rounded-full border border-white/50 bg-white/70 px-3 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-plum backdrop-blur">
          Before
        </span>
      </div>
      <span className="absolute right-3 top-3 rounded-full border border-white/40 bg-plum px-3 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-white shadow-sm">
        After
      </span>

      {/* Handle */}
      <div
        className="pointer-events-none absolute top-0 h-full w-0.5 bg-white/90 shadow-[0_0_14px_rgba(154,123,31,0.5)]"
        style={{ left: `${pos}%` }}
      >
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-plum text-white shadow-dew"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

const TAGS = ["Anti-wrinkle", "Dermal filler", "Skin rejuvenation"];

export default function CaseStudy() {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-[#E8E8E8] bg-pearl-deep p-6 sm:p-8">
      <div className="grid items-center gap-8 md:grid-cols-2">
        {/* Comparison */}
        <div>
          <PortraitCompare before={BEFORE_SRC} after={AFTER_SRC} />
          <p className="mt-3 text-center text-[0.7rem] uppercase tracking-[0.16em] text-plum-mute">
            Drag the slider to compare
          </p>
        </div>

        {/* Write-up */}
        <div>
          <p className="eyebrow">Treatment example</p>
          <h4 className="display mt-2 text-2xl text-plum sm:text-3xl">
            Facial rejuvenation
          </h4>
          <p className="mt-4 leading-relaxed text-plum">
            An illustration of the kind of bespoke facial rejuvenation plan
            offered at Aesthetics Central Clinic — softening fine lines, firming
            and refining the skin and evening overall tone for a naturally rested, more
            youthful result that still looks like you.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {TAGS.map((t) => (
              <span
                key={t}
                className="rounded-full border border-[#E0E0E0] bg-white/70 px-3 py-1 text-[0.7rem] font-medium text-plum-soft"
              >
                {t}
              </span>
            ))}
          </div>

          <p className="mt-5 text-xs italic text-plum-mute">
            Illustrative example for demonstration only. Individual results vary
            and are not guaranteed.
          </p>
        </div>
      </div>
    </div>
  );
}
