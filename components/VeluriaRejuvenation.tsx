"use client";

import type { ReactNode } from "react";
import type { AnalysisCategory } from "@/lib/types";

type Benefit = {
  title: string;
  detail: string;
  icon: ReactNode;
};

/* Inline icons keep the gold accent line style consistent with the rest of the app. */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const BENEFITS: Benefit[] = [
  {
    title: "Bio-remodelling from within",
    detail: "Enzymes restructure and renew the skin's deeper layers.",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M7 4c0 5 10 5 10 10s-10 5-10 10M17 4c0 5-10 5-10 10s10 5 10 10" />
        <path d="M8.5 8h7M8.5 16h7" />
      </svg>
    ),
  },
  {
    title: "Stimulates your own collagen",
    detail: "Kick-starts natural collagen & elastin for firmer skin.",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M6 6l-2-2M20 20l-2-2M18 6l2-2M4 20l2-2" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    ),
  },
  {
    title: "Deep, lasting hydration",
    detail: "Restores plump, dewy, supple-looking skin.",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z" />
      </svg>
    ),
  },
  {
    title: "Smoother texture & pores",
    detail: "Refines roughness and softens the look of pores.",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M3 17c3-3 5-3 8 0s5 3 8 0M3 11c3-3 5-3 8 0s5 3 8 0" />
      </svg>
    ),
  },
  {
    title: "Softened fine lines",
    detail: "Lines and creases look shallower and softer.",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M4 9c4-2 12-2 16 0M4 15c4-2 12-2 16 0" />
      </svg>
    ),
  },
  {
    title: "Fresher under-eye skin",
    detail: "Smoother, better-hydrated, less crepey eye area.",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" />
        <circle cx="12" cy="12" r="2.6" />
      </svg>
    ),
  },
  {
    title: "Improved elasticity",
    detail: "The appearance of firmer, springier, healthier skin.",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 000 18" fill="currentColor" opacity="0.12" stroke="none" />
        <path d="M12 3a9 9 0 000 18" />
      </svg>
    ),
  },
  {
    title: "Natural lit-from-within glow",
    detail: "A healthy radiance that reads as great skin.",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M12 4l1.8 4.2L18 10l-4.2 1.8L12 16l-1.8-4.2L6 10l4.2-1.8L12 4z" />
        <path d="M18.5 16l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8.8-1.8z" />
      </svg>
    ),
  },
  {
    title: "Refreshed — still you",
    detail: "Rejuvenated and natural, never overdone.",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 10h.01M15 10h.01M8.5 14c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" />
      </svg>
    ),
  },
];

/**
 * Categories the Veluria range genuinely addresses — which is all of them.
 *
 * This set used to exclude "Tone & redness" on the belief that pigmentation was
 * "not booster-treatable". That was a leftover from when the app modelled
 * Veluria as one hydrating booster: Pearl Tone (glutathione) is sold
 * specifically to even tone and soften hyperpigmentation, and Ultra Lift (DMAE)
 * for firmness. Excluding them meant the focus chips silently dropped the two
 * concerns most clients actually arrive with.
 */
const BOOSTER_SCOPE = new Set([
  "Hydration",
  "Radiance",
  "Texture & pores",
  "Fine lines",
  "Tone & redness",
  "Firmness & elasticity",
]);

/** Lowest-scoring IN-SCOPE categories become the personalised focus chips. */
function focusAreas(categories: AnalysisCategory[]): string[] {
  return [...(categories ?? [])]
    .filter((c) => BOOSTER_SCOPE.has(c.label))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((c) => c.label);
}

/**
 * True when the patient's redness/pigmentation category scored low enough to be
 * a visible concern. The section then adds an honest note drawing the one line
 * that still holds here: Pearl Tone evens pigment and Silk Skin calms irritated
 * redness, but a visible THREAD VEIN is a vessel and no booster removes it.
 *
 * The note used to say pigmentation itself sat "beyond what a skin booster
 * treats", which contradicted Pearl Tone and talked the client out of the
 * product they were being recommended two paragraphs above.
 */
function hasOutOfScopeConcern(categories: AnalysisCategory[]): boolean {
  const tone = (categories ?? []).find((c) => c.label === "Tone & redness");
  return !!tone && tone.score < 70;
}

export default function VeluriaRejuvenation({
  categories,
  cta,
}: {
  categories: AnalysisCategory[];
  cta?: ReactNode;
}) {
  const focus = focusAreas(categories);
  const outOfScopeConcern = hasOutOfScopeConcern(categories);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[#E8E8E8] bg-pearl-deep p-6 sm:p-10">
      <p className="eyebrow">The Rejuvenation</p>
      <h3 className="display mt-3 text-3xl text-plum sm:text-4xl">
        Rejuvenate from within with <span className="serum-text italic">Veluria</span>
      </h3>
      <p className="mt-4 max-w-2xl leading-relaxed text-plum">
        Veluria is an advanced <strong className="font-semibold">PB Serum
        enzyme-based bio-remodelling treatment</strong>, offered at Aesthetics Central Clinic.
        Rather than sitting on the surface, its enzymes work <em>within</em> your
        skin — gently restructuring and renewing it from the deeper layers, so
        your complexion looks firmer, fresher and naturally rejuvenated.
      </p>

      {/* Personalised focus — pulled from this patient's lowest scores */}
      {focus.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/70 bg-white/55 p-4 backdrop-blur-sm sm:p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-plum-soft">
            Based on your scan, Veluria will focus on
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {focus.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-serum/12 px-3 py-1.5 text-sm font-medium text-[#3F3E3E]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-serum" />
                {label}
              </span>
            ))}
          </div>
          {outOfScopeConcern && (
            <p className="mt-3 text-xs leading-relaxed text-[#96652a]">
              An honest note: uneven tone and pigmentation are exactly what
              Veluria Pearl Tone is for, and Silk Skin calms irritated-looking
              redness — but any visible thread veins or broken capillaries are
              vessels, and no skin booster removes those. Aesthetics Central&rsquo;s
              clinicians will advise on the right approach for those at your
              consultation.
            </p>
          )}
        </div>
      )}

      {/* All key benefits */}
      <div className="mt-7 grid gap-x-6 gap-y-5 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <div key={b.title} className="flex items-start gap-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-serum/30 bg-white/70 text-serum [&>svg]:h-[18px] [&>svg]:w-[18px]">
              {b.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-plum">{b.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-plum-soft">{b.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {cta && <div className="mt-8">{cta}</div>}
    </div>
  );
}
