"use client";

import { useEffect, useState } from "react";
import { loadImage, toSquare } from "@/lib/canvas";

/**
 * Today, building, and the finished result.
 *
 * WHY THIS EXISTS. A single "after" frame sells a photograph. It answers "what
 * could I look like" and leaves "is this something that happens to me overnight"
 * untouched — and Veluria is enzyme-driven bioremodeling, so it emphatically is
 * not. Collagenase clears disorganised collagen and new collagen is laid down
 * behind it; the result arrives gradually and keeps arriving. Showing only the
 * endpoint invited the client to read it as a filter.
 *
 * NO PROTOCOL IS NAMED HERE, and that is a deliberate reversal. This component
 * used to label its stages "Session 3" and "Full course of 5", computed from
 * the matched products' vial counts. That was prescribing: how many sessions
 * someone needs is a clinical decision that belongs to the doctor with the
 * client in front of them, not to a report generated from a selfie. The stages
 * now describe the SHAPE of the change — it builds, then it settles — and say
 * nothing about how long that takes or what it costs.
 *
 * THE MIDDLE FRAMES ARE DERIVED, NOT GENERATED, and that is a safety property
 * rather than a shortcut. lib/glow.ts records what happened the last time a
 * second generative pass was put in this pipeline: each pass preserves features
 * only relative to its own input, so acne was visibly erased as the erosion
 * compounded. A cross-fade between two images the client can already see in
 * full cannot invent or delete anything — a blemish present in both endpoints
 * is present at every point in between, by construction.
 */

/**
 * How far toward the simulated endpoint each intermediate frame sits.
 *
 * Deliberately back-loaded. Bioremodelling is cumulative and the collagen laid
 * down early is still remodelling long after it was laid down, so evenly spaced
 * frames would overstate how much has happened by the middle of a course.
 */
const BLEND = [0.3, 0.62];

interface Step {
  key: string;
  label: string;
  sub: string;
}

const STEPS: Step[] = [
  { key: "today", label: "Today", sub: "Your photo" },
  { key: "early", label: "It begins", sub: "Collagen rebuilding" },
  { key: "building", label: "Building", sub: "Firmer, clearer" },
  { key: "full", label: "Your full result", sub: "Where it settles" },
];

export default function CourseProgression({
  before,
  after,
  onStep,
}: {
  before: string;
  after: string;
  onStep?: (key: string) => void;
}) {
  const [blended, setBlended] = useState<string[] | null>(null);
  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [b, a] = await Promise.all([loadImage(before), loadImage(after)]);
        if (cancelled) return;
        const squareAfter = toSquare(a, 1024);
        const frames = BLEND.map((alpha) => {
          const canvas = toSquare(b, 1024);
          const ctx = canvas.getContext("2d");
          if (!ctx) return before;
          ctx.globalAlpha = alpha;
          ctx.drawImage(squareAfter, 0, 0);
          ctx.globalAlpha = 1;
          return canvas.toDataURL("image/jpeg", 0.92);
        });
        setBlended(frames);
      } catch {
        // Fall back to the two real endpoints rather than breaking the section.
        if (!cancelled) setBlended(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [before, after]);

  const frames = [before, blended?.[0] ?? before, blended?.[1] ?? after, after];

  const select = (i: number) => {
    if (i === active) return;
    setFading(true);
    setActive(i);
    onStep?.(STEPS[i].key);
    window.setTimeout(() => setFading(false), 40);
  };

  return (
    <div className="mt-8">
      <div className="mb-3 text-center">
        <p className="eyebrow">How it builds</p>
        <h4 className="display mt-1 text-xl text-plum sm:text-2xl">
          Your result, as it develops
        </h4>
      </div>

      <div className="relative overflow-hidden rounded-[1.6rem] border border-white/70 bg-pearl-deep shadow-dew">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frames[active]}
          alt={STEPS[active].label}
          className={`aspect-square w-full object-cover transition-opacity duration-500 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
          draggable={false}
        />
        <span className="absolute left-3 top-3 rounded-full border border-white/50 bg-white/75 px-3 py-1 text-[0.6rem] uppercase tracking-[0.18em] text-plum backdrop-blur">
          {STEPS[active].label}
        </span>
      </div>

      {/*
        Four tabs at 360px leaves ~78px each, which is enough for the label but
        not for the sub-line beside it — so the sub-line drops to its own row
        rather than wrapping mid-word. The grid stays 4-up at every tier: making
        it 2x2 on mobile would break the left-to-right reading of a progression.
      */}
      <div
        role="tablist"
        aria-label="How the result develops"
        className="mt-4 grid grid-cols-4 gap-1.5 sm:gap-2"
      >
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={i === active}
            onClick={() => select(i)}
            className={`rounded-2xl border px-1.5 py-2 text-center transition sm:px-3 sm:py-2.5 ${
              i === active
                ? "border-plum/30 bg-plum text-white shadow-sm"
                : "border-white/70 bg-white/55 text-plum hover:bg-white/80"
            }`}
          >
            <span className="block text-[0.68rem] font-semibold leading-tight tracking-wide sm:text-xs">
              {s.label}
            </span>
            <span
              className={`mt-0.5 hidden text-[0.65rem] sm:block ${
                i === active ? "text-white/75" : "text-plum-soft"
              }`}
            >
              {s.sub}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-3 text-center text-xs italic leading-relaxed text-plum-mute">
        The middle stages are illustrative steps between your photo and your
        simulated result, not a prediction of any particular moment. Veluria is
        enzyme-based, so the change builds gradually rather than appearing at
        once.
      </p>
    </div>
  );
}
