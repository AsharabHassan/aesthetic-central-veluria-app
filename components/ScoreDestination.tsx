"use client";

import type { ReactNode } from "react";
import type { AnalysisCategory } from "@/lib/types";
import { overallProjection } from "@/lib/expectations";

/**
 * One number, at the top of the report: your skin today, and where the full
 * Veluria programme can take it.
 *
 * WHY THIS EXISTS. The report's numbers were all deltas — "+10–20%", "+15–25%"
 * — scattered across six category bars and seven callout rows, and a delta is
 * the wrong shape for this decision. It describes an increment, so it invites
 * the reading "that is not very much"; and split six ways it never adds up to
 * anything a person can hold in their head. Nobody books a consultation for a
 * percentage. They book for a destination.
 *
 * So the same arithmetic is stated once, as somewhere to arrive, above the
 * fold, with the ask directly underneath it — because a meaningful share of
 * clients never scroll as far as the preview at all, and until now the page
 * gave those people nothing to act on.
 *
 * NO CLAIM IS WIDENED TO PRODUCE IT. `overallProjection` averages the same
 * per-category calibration the six bars below already show, with the same
 * conservative ceilings; categories outside the range are excluded rather than
 * counted, so the headline can never disagree with the bars beneath it.
 */
export default function ScoreDestination({
  categories,
  cta,
}: {
  categories: AnalysisCategory[];
  cta?: ReactNode;
}) {
  const projection = overallProjection(categories);
  if (!projection) return null;

  const { from, to } = projection;
  if (to <= from) return null;

  return (
    <div className="glass p-6 text-center sm:p-8">
      <p className="eyebrow">Your skin score</p>

      {/*
        The pair stays side by side at every width — it is a single comparison
        and stacking it would turn it into two unrelated facts. At 360px the
        numbers render ~56px each, which the row absorbs comfortably.
      */}
      <div className="mt-4 flex items-center justify-center gap-4 sm:gap-7">
        <div>
          <p className="font-display text-5xl leading-none text-plum-mute sm:text-6xl">
            {from}
          </p>
          <p className="mt-2 text-[0.6rem] uppercase tracking-[0.16em] text-plum-mute">
            Today
          </p>
        </div>

        <svg
          viewBox="0 0 40 16"
          className="h-4 w-8 shrink-0 text-plum-mute/50 sm:h-5 sm:w-10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M1 8h36M30 2l7 6-7 6" />
        </svg>

        <div>
          <p className="font-display text-5xl leading-none text-plum sm:text-6xl">
            {to}
          </p>
          <p className="mt-2 text-[0.6rem] uppercase tracking-[0.16em] text-plum-soft">
            With Veluria
          </p>
        </div>
      </div>

      <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-plum-soft">
        Across the six things we measured, this is where your skin can get to on
        a full Veluria programme — and the preview below is what that looks like
        on your own face.
      </p>

      {cta && <div className="mt-6 flex flex-col items-center gap-2">{cta}</div>}
    </div>
  );
}
