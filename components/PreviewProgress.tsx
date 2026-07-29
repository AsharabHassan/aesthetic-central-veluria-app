"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The wait for the after photograph.
 *
 * WHY IT IS NOT THE PICTURE ITSELF. The generation streams progressive renders,
 * and the first version of this showed them: the client watched a half-formed
 * face resolve. It reads as a broken or badly-retouched photograph rather than
 * as progress, which is worse than showing nothing — the owner's words were
 * "this doesn't look good at all". The stream is still used, but as a PROGRESS
 * SIGNAL only. The model's rough drafts are not client-facing work.
 *
 * WHY THE BAR IS HONEST. Each step is a real checkpoint reported by the API, not
 * a timer pretending to know. Between checkpoints the fill eases forward but
 * never reaches the next mark, so it always reads as moving without ever
 * claiming progress that has not happened.
 *
 * The scan line is the house device (`animate-face-scan`, already used on the
 * analysis step) — a clinical light passing over the client's own photograph.
 * It ties the wait to what is actually happening: their picture is being worked
 * on. Nothing else moves; the bar and the line are the whole of it.
 */

/** The checkpoints the stream actually reports, in order. */
const STAGES = [
  "Setting up your photograph",
  "Rendering your result",
  "Refining skin detail",
  "Final pass",
] as const;

export default function PreviewProgress({
  before,
  stage,
}: {
  /** The client's own photo — the thing being worked on. */
  before: string;
  /** How many checkpoints have landed: 0 through STAGES.length - 1. */
  stage: number;
}) {
  const clamped = Math.max(0, Math.min(STAGES.length - 1, stage));
  const [fill, setFill] = useState(0);
  const target = useRef(0);

  // Each checkpoint owns a band of the bar. Within its band the fill eases
  // toward — but never reaches — the next checkpoint, so the bar is always
  // moving and never overstates where the work has actually got to.
  useEffect(() => {
    target.current = clamped / STAGES.length;
    const ceiling = (clamped + 1) / STAGES.length;
    const id = window.setInterval(() => {
      setFill((f) => {
        const next = f + (ceiling - 0.012 - f) * 0.04;
        return next > f ? next : f;
      });
    }, 220);
    return () => window.clearInterval(id);
  }, [clamped]);

  return (
    <div className="relative flex aspect-square w-full items-end overflow-hidden rounded-[1.6rem] border border-white/70 bg-pearl-deep">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={before}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-105 object-cover opacity-45 blur-[2px]"
      />
      {/*
        Weighted to the foot of the frame, not flat. The copy needs an opaque
        bed to sit on, while the top stays legible as the client's own face —
        without it the panel is a large empty cream square and reads as broken
        rather than busy.
      */}
      <div className="absolute inset-0 bg-gradient-to-t from-pearl-deep via-pearl-deep/85 to-pearl-deep/25" />

      {/* The clinical pass. Hidden when the client prefers reduced motion. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-full motion-reduce:hidden"
      >
        <div className="animate-face-scan h-24 w-full bg-gradient-to-b from-transparent via-gold/30 to-transparent" />
      </div>

      <div
        className="relative w-full px-7 pb-8 sm:px-9 sm:pb-10"
        role="status"
        aria-live="polite"
      >
        <p className="eyebrow">Preparing your result</p>
        <p className="display mt-2 text-2xl text-plum sm:text-[1.75rem]">
          {STAGES[clamped]}
        </p>

        <div className="mt-5 h-px w-full bg-plum/12">
          <div
            className="h-px bg-serum transition-[width] duration-700 ease-out"
            style={{ width: `${Math.round(fill * 100)}%` }}
          />
        </div>

        <p className="mt-3 text-xs text-plum-mute">
          Step {clamped + 1} of {STAGES.length} · your photograph is rendered at
          full clinical resolution, which takes around three minutes.
        </p>
      </div>
    </div>
  );
}
