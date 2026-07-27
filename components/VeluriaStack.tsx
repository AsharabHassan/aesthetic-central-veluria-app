"use client";

import type { ReactNode } from "react";
import type { VeluriaProduct } from "@/lib/veluria";

/**
 * Why the result above takes more than one product.
 *
 * WHY THIS EXISTS. The report named the client's matched products under the
 * preview and left it there, which invited the reading that Veluria is a menu
 * — pick the one for your concern. It is not. Every product in the range is
 * built on the same recombinant collagenase, all three act on luminosity and
 * two of the three act on firmness, so used together they compound on the same
 * parameters rather than dividing the face between them. That compounding is
 * the reason the result in the preview looks the way it does, and the page was
 * never saying so.
 *
 * NOTHING HERE PRESCRIBES. It explains what each product contributes to a
 * combined result. It does not say how many of anything anyone needs, how long
 * it takes, or what it costs — those are the doctor's, at the consultation.
 *
 * Claim wording is the manufacturer's own throughout. It is already
 * appearance-level, which makes it the safest form of every claim we make.
 */

const ENZYME_NOTE =
  "Veluria is enzyme-based. Recombinant collagenase clears disorganised collagen so your skin can lay down new, better-organised collagen behind it — which is why the result builds over time instead of appearing overnight, and why it is skin that has genuinely been rebuilt rather than skin that has been coated.";

export default function VeluriaStack({
  programme,
  cta,
}: {
  programme: VeluriaProduct[];
  cta?: ReactNode;
}) {
  if (programme.length === 0) return null;

  const combined = programme.length > 1;

  return (
    <div>
      <div className="mb-6 text-center">
        <p className="eyebrow">Your Veluria</p>
        <h3 className="display mt-2 text-3xl text-plum">
          {combined ? "Why it takes more than one" : "What your skin matched"}
        </h3>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-plum-soft">
          {combined
            ? "These are not alternatives. Each one is built on the same enzyme and each does a different job — and because they all act on how your skin catches the light, their effects stack rather than divide."
            : "This is the part of the Veluria range your skin matched, and what it does."}
        </p>
      </div>

      {/*
        One column on mobile so each card's copy stays a comfortable measure,
        three across from the small breakpoint up. At 768px three cards are
        ~230px each, which is still a readable column for two short lines.
      */}
      <div
        className={`grid gap-3 sm:gap-4 ${
          programme.length === 1
            ? "mx-auto max-w-md grid-cols-1"
            : programme.length === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-3"
        }`}
      >
        {programme.map((p) => (
          <div
            key={p.id}
            className="flex flex-col rounded-2xl border border-white/60 bg-white/55 p-5 backdrop-blur-sm"
          >
            <h4 className="text-sm font-semibold text-plum">{p.name}</h4>
            <p className="mt-1 text-xs leading-relaxed text-plum-mute">
              {p.tagline}
            </p>
            <div className="my-3 hairline" />
            <p className="text-xs leading-relaxed text-plum-soft">
              <span className="font-semibold text-plum">Adds</span> {p.contributes}.
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/70 bg-white/45 p-5 backdrop-blur-sm">
        <p className="text-xs leading-relaxed text-plum-soft">{ENZYME_NOTE}</p>
        <p className="mt-3 text-xs leading-relaxed text-plum-soft">
          Delivered by microneedling, so it reaches the layer of skin where that
          rebuilding happens. Exactly what your skin needs, and how much of it,
          is what the consultation is for.
        </p>
      </div>

      {cta && <div className="mt-6 flex justify-center">{cta}</div>}
    </div>
  );
}
