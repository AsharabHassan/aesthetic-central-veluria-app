"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function BeforeAfterSlider({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  // Start on the BEFORE, then sweep across once the image lands.
  const [pos, setPos] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  // Set the moment the person touches the slider: the sweep must yield to them
  // immediately, or it keeps overwriting the position they are dragging to.
  const grabbed = useRef(false);
  // Set only once the sweep has FINISHED — see the effect below.
  const sweptOnce = useRef(false);

  /**
   * Sweep the reveal once, automatically.
   *
   * Parked at 50%, the slider shows the LEFT half of the before beside the RIGHT
   * half of the after — two different parts of the face, lit differently. People
   * were reading that as "nothing changed" even when the skin had visibly
   * improved, because they never saw the same square of skin both ways. The
   * sweep shows the whole face transform, which is what makes the result land.
   */
  useEffect(() => {
    // The "already swept" flag is set on COMPLETION, never on initiation. React
    // StrictMode invokes effects twice in development: a flag set up-front makes
    // the second pass bail out while the first pass's cleanup has already
    // cancelled the animation, so the sweep silently never runs. Marking it done
    // only at the end means a double-invoke simply restarts the sweep.
    //
    // It also has to be once-ever, not once-per-`after`: the preview arrives
    // first and the sharper pass replaces it ~30s later, and re-playing the
    // whole reveal under the client at that point would look like a glitch.
    if (!after || grabbed.current || sweptOnce.current) return;
    setPos(100);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      sweptOnce.current = true;
      setPos(50);
      return;
    }
    let raf = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const HOLD = 550;
    const SWEEP = 1500;
    const start = performance.now();
    const tick = (now: number) => {
      if (grabbed.current) return; // the person took over — stop animating
      const t = now - start;
      if (t < HOLD) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(1, (t - HOLD) / SWEEP);
      const eased = 1 - Math.pow(1 - p, 3);
      // 100 (all before) -> 0 (all after), then settle at 50 so it stays draggable.
      setPos(100 - eased * 100);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        sweptOnce.current = true; // finished — don't replay when the sharper pass lands
        settle = setTimeout(() => {
          if (!grabbed.current) setPos(50);
        }, 450);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (settle) clearTimeout(settle);
    };
  }, [after]);

  const move = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    grabbed.current = true; // hand control to the person; the sweep stops
    sweptOnce.current = true;
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
      className="relative aspect-square w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-[1.6rem] border border-white/70 bg-pearl-deep shadow-dew"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* After (full background) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={after}
        alt="Simulated result"
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
          alt="Your photo"
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
        className="pointer-events-none absolute top-0 h-full w-0.5 bg-white/90 shadow-[0_0_14px_rgba(22,179,198,0.7)]"
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
