"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Mapping your facial landmarks...",
  "Assessing hydration, texture & tone...",
  "Composing your treatment map...",
  "Rendering your treatment preview...",
];

const LANDMARKS = [
  { x: 50, y: 24, delay: "0ms" },
  { x: 37, y: 39, delay: "180ms" },
  { x: 63, y: 39, delay: "320ms" },
  { x: 33, y: 54, delay: "520ms" },
  { x: 67, y: 54, delay: "700ms" },
  { x: 50, y: 66, delay: "920ms" },
  { x: 50, y: 78, delay: "1120ms" },
];

function FaceMapLoader() {
  return (
    <div className="relative flex h-72 w-72 items-center justify-center sm:h-80 sm:w-80">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/cinematic/halo-orbit-close.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -inset-14 max-w-none object-contain opacity-20 mix-blend-screen"
        style={{
          width: "calc(100% + 7rem)",
          height: "calc(100% + 7rem)",
          animation: "cinematic-halo-spin 22s linear infinite",
        }}
        draggable={false}
      />
      <div className="absolute inset-0 rounded-full border border-plum/15" />
      <div className="absolute inset-4 rounded-full border border-white/80" />
      <div className="absolute inset-8 rounded-full border border-plum/10" />

      <div className="relative h-[15.5rem] w-[15.5rem] overflow-hidden rounded-[2rem] border border-white/80 bg-white/45 shadow-glass backdrop-blur-md sm:h-[17rem] sm:w-[17rem]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/face-map-premium.webp"
          alt=""
          aria-hidden="true"
          className="h-full w-full animate-soft-focus-reveal object-cover"
          draggable={false}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-plum/10" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/cinematic/micro-texture-glow.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-screen"
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/cinematic/face-zone-hairline.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-30 mix-blend-screen"
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/cinematic/scan-beam-horizontal.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-screen"
          style={{
            animation: "cinematic-scan-down 4.6s cubic-bezier(0.65, 0, 0.35, 1) infinite",
          }}
          draggable={false}
        />
        <div className="absolute inset-x-0 top-0 h-1/2 animate-face-scan bg-gradient-to-b from-transparent via-white/55 to-transparent">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-plum/40 to-transparent" />
        </div>

        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          role="img"
          aria-label="Animated facial assessment map"
        >
          <g
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="0.42"
          >
            <path
              className="animate-trace-draw"
              d="M50 13 C41 20 37 31 38 42 C39 54 43 62 50 71 C57 62 61 54 62 42 C63 31 59 20 50 13"
              pathLength={1}
              stroke="rgba(255,255,255,0.92)"
              style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
            />
            <path
              className="animate-trace-draw"
              d="M28 36 C37 30 45 31 50 38 C55 31 63 30 72 36"
              pathLength={1}
              stroke="rgba(22,179,198,0.78)"
              style={{
                animationDelay: "280ms",
                strokeDasharray: 1,
                strokeDashoffset: 1,
              }}
            />
            <path
              className="animate-trace-draw"
              d="M28 60 C38 55 44 57 50 64 C56 57 62 55 72 60"
              pathLength={1}
              stroke="rgba(255,255,255,0.82)"
              style={{
                animationDelay: "520ms",
                strokeDasharray: 1,
                strokeDashoffset: 1,
              }}
            />
            <path
              className="animate-trace-draw"
              d="M50 18 L50 84"
              pathLength={1}
              stroke="rgba(22,179,198,0.6)"
              style={{
                animationDelay: "720ms",
                strokeDasharray: 1,
                strokeDashoffset: 1,
              }}
            />
          </g>
        </svg>

        {LANDMARKS.map((point, index) => (
          <span
            key={`${point.x}-${point.y}`}
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-plum/80"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <span
              className="absolute inset-0 animate-map-pulse rounded-full border border-plum/40"
              style={{ animationDelay: point.delay }}
            />
            <span className="sr-only">Assessment point {index + 1}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Processing() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      3500,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center py-16 text-center">
      <FaceMapLoader />

      <p className="display mt-8 text-3xl text-plum">Analysing your skin</p>
      <p className="mt-3 min-h-[1.5rem] text-sm tracking-wide text-plum-soft transition-all">
        {STEPS[step]}
      </p>

      <div className="relative mt-8 h-px w-56 overflow-hidden rounded-full bg-[#E8E8E8]">
        <div className="absolute inset-y-0 w-1/3 animate-sheen rounded-full bg-gradient-to-r from-transparent via-plum/30 to-transparent" />
      </div>
      <p className="mt-5 max-w-[17rem] text-balance text-[0.65rem] uppercase leading-relaxed tracking-[0.14em] text-plum-mute">
        Map and preview render together
      </p>
    </section>
  );
}
