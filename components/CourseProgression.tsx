"use client";

import { useEffect, useRef, useState } from "react";
import { loadImage, toSquare } from "@/lib/canvas";
import type { VeluriaProduct } from "@/lib/veluria";

/**
 * Today / partway through / at twelve weeks.
 *
 * WHY THIS EXISTS. A single "after" frame sells a photograph. It answers "what
 * could I look like" and leaves "what would I actually be buying" untouched —
 * and what the client is buying is a COURSE: three sessions of Silk Skin or
 * Pearl Tone, five of Ultra Lift, reviewed at twelve weeks. Showing the
 * endpoint alone made the course length feel like a cost attached to a picture
 * rather than the thing producing it.
 *
 * THE MIDPOINT IS DERIVED, NOT GENERATED, and that is a safety property rather
 * than a shortcut. lib/glow.ts records what happened the last time a second
 * generative pass was put in this pipeline: each pass preserves features only
 * relative to its own input, so acne was visibly erased as the erosion
 * compounded. A cross-fade between two images the client can already see in
 * full cannot invent or delete anything — a blemish present in both endpoints
 * is present at every point in between, by construction.
 *
 * It is labelled as an illustration for the same reason: it is an interpolation
 * toward a simulated endpoint, not a prediction of week six.
 */

/**
 * How far toward the simulated endpoint the midpoint frame sits.
 *
 * Deliberately below 0.5. Bioremodelling is cumulative and back-loaded —
 * collagen laid down after the first sessions is still remodelling at the
 * twelve-week review — so a linear midpoint would overstate where someone
 * actually is halfway through their course.
 */
const MIDPOINT = 0.45;

interface Step {
  key: string;
  label: string;
  sub: string;
}

export default function CourseProgression({
  before,
  after,
  plan,
  onStep,
}: {
  before: string;
  after: string;
  plan: VeluriaProduct[];
  onStep?: (key: string) => void;
}) {
  const [midpoint, setMidpoint] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);

  // The course is as long as its longest product: someone on Ultra Lift plus
  // Silk Skin is on a five-session plan, not a three-session one.
  const sessions = plan.length > 0 ? Math.max(...plan.map((p) => p.sessions)) : 3;
  const halfway = Math.max(1, Math.round(sessions / 2));

  const steps: Step[] = [
    { key: "today", label: "Today", sub: "Your photo" },
    {
      key: "midway",
      label: `Session ${halfway}`,
      sub: "Partway through",
    },
    { key: "week12", label: "12 weeks", sub: `Full course of ${sessions}` },
  ];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [b, a] = await Promise.all([loadImage(before), loadImage(after)]);
        if (cancelled) return;
        const canvas = toSquare(b, 1024);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.globalAlpha = MIDPOINT;
        ctx.drawImage(toSquare(a, 1024), 0, 0);
        ctx.globalAlpha = 1;
        setMidpoint(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        // Fall back to hiding the middle step rather than breaking the section.
        if (!cancelled) setMidpoint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [before, after]);

  const frames = [before, midpoint ?? before, after];

  const select = (i: number) => {
    if (i === active) return;
    setFading(true);
    setActive(i);
    onStep?.(steps[i].key);
    window.setTimeout(() => setFading(false), 40);
  };

  return (
    <div className="mt-8">
      <div className="mb-3 text-center">
        <p className="eyebrow">How it builds</p>
        <h4 className="display mt-1 text-xl text-plum sm:text-2xl">
          Your course, step by step
        </h4>
      </div>

      <div className="relative overflow-hidden rounded-[1.6rem] border border-white/70 bg-pearl-deep shadow-dew">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frames[active]}
          alt={steps[active].label}
          className={`aspect-square w-full object-cover transition-opacity duration-500 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
          draggable={false}
        />
        <span className="absolute left-3 top-3 rounded-full border border-white/50 bg-white/75 px-3 py-1 text-[0.6rem] uppercase tracking-[0.18em] text-plum backdrop-blur">
          {steps[active].label}
        </span>
      </div>

      <div
        role="tablist"
        aria-label="Treatment course stages"
        className="mt-4 grid grid-cols-3 gap-2"
      >
        {steps.map((s, i) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={i === active}
            onClick={() => select(i)}
            className={`rounded-2xl border px-3 py-2.5 text-center transition ${
              i === active
                ? "border-plum/30 bg-plum text-white shadow-sm"
                : "border-white/70 bg-white/55 text-plum hover:bg-white/80"
            }`}
          >
            <span className="block text-xs font-semibold tracking-wide">
              {s.label}
            </span>
            <span
              className={`mt-0.5 block text-[0.65rem] ${
                i === active ? "text-white/75" : "text-plum-soft"
              }`}
            >
              {s.sub}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-3 text-center text-xs italic leading-relaxed text-plum-mute">
        The middle stage is an illustrative midpoint between your photo and your
        simulated twelve-week result, not a prediction of any particular week.
        Results build over the course and are reviewed at twelve weeks.
      </p>
    </div>
  );
}
