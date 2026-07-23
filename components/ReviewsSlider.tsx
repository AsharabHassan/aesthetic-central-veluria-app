"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Review = {
  text: string;
  name: string;
};

// EMPTY ON PURPOSE — DO NOT PASTE ANOTHER CLINIC'S REVIEWS IN HERE.
//
// This fork inherited O.D. Aesthetics' genuine Google and Instagram reviews,
// which name real O.D. clients. Re-attributing them to Aesthetics Central
// would be inventing testimonials for a business that never received them.
// They were removed rather than reworded.
//
// To switch the section on, paste Aesthetics Central's OWN reviews here,
// verbatim and correctly attributed; the section below hides itself while
// this list is empty.
const REVIEWS: Review[] = [];

/** Lets the report hide the whole section while the list is empty. */
export const REVIEW_COUNT = REVIEWS.length;

const AUTOPLAY_MS = 7000;

function Stars() {
  return (
    <div className="flex gap-0.5" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="15"
          height="15"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="text-serum"
          aria-hidden="true"
        >
          <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.6z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const paragraphs = review.text.split("\n");
  return (
    <figure className="flex h-full w-full flex-col rounded-[1.6rem] border border-white/70 bg-white/55 p-6 backdrop-blur-xl shadow-dew sm:p-8">
      <svg
        width="34"
        height="34"
        viewBox="0 0 32 32"
        fill="currentColor"
        className="mb-4 shrink-0 text-serum/45 sm:mb-5"
        aria-hidden="true"
      >
        <path d="M13 8H6a2 2 0 00-2 2v6a2 2 0 002 2h4v2a3 3 0 01-3 3H6v3h1a6 6 0 006-6V8zm15 0h-7a2 2 0 00-2 2v6a2 2 0 002 2h4v2a3 3 0 01-3 3h-1v3h1a6 6 0 006-6V8z" />
      </svg>

      <blockquote className="grow space-y-3 text-[0.95rem] leading-relaxed text-plum sm:text-base">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </blockquote>

      <figcaption className="mt-6 flex flex-col gap-2 border-t border-[#E8E8E8] pt-5">
        <Stars />
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-display text-lg text-plum">{review.name}</span>
          <span className="text-[0.7rem] uppercase tracking-[0.14em] text-plum-mute">
            Verified patient
          </span>
        </div>
      </figcaption>
    </figure>
  );
}

export default function ReviewsSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = REVIEWS.length;

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );
  const prev = useCallback(() => go(index - 1), [go, index]);
  const next = useCallback(() => go(index + 1), [go, index]);

  // Auto-advance, paused on hover / focus / touch.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, count]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    touchStartX.current = null;
    setPaused(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="group"
      aria-roledescription="carousel"
      aria-label="Patient reviews"
    >
      {/* Viewport */}
      <div
        className="overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {REVIEWS.map((review, i) => (
            <div
              key={review.name}
              className="w-full shrink-0 px-px"
              aria-hidden={i !== index}
            >
              <ReviewCard review={review} />
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          onClick={prev}
          aria-label="Previous review"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E0E0E0] bg-white/70 text-plum transition hover:border-plum hover:bg-white"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {REVIEWS.map((review, i) => (
            <button
              key={review.name}
              onClick={() => go(i)}
              aria-label={`Go to review ${i + 1}`}
              aria-current={i === index}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-6 bg-plum"
                  : "w-2 bg-plum-mute/40 hover:bg-plum-mute/70"
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          aria-label="Next review"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E0E0E0] bg-white/70 text-plum transition hover:border-plum hover:bg-white"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
