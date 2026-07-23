"use client";

import { useEffect, useState } from "react";
import type { FaceAnnotation } from "@/lib/types";

const MAP_STEPS = [
  "Detecting facial zones…",
  "Plotting assessment points…",
  "Labelling treatment areas…",
  "Finishing your map…",
];

function MapLoader({ image }: { image: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const pct = Math.min(95, Math.round(100 * (1 - Math.exp(-elapsed / 22))));
  const step = MAP_STEPS[Math.min(Math.floor(elapsed / 14), MAP_STEPS.length - 1)];

  return (
    <div className="relative h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt="Your photo"
        className="h-full w-full object-cover blur-md brightness-95"
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-plum/20 to-transparent" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-white/30 px-8 text-center backdrop-blur-sm">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border border-plum/15" />
          <div className="absolute inset-0 animate-[spin_3s_linear_infinite] rounded-full border-2 border-transparent border-t-plum" />
        </div>
        <p className="text-sm tracking-wide text-plum">{step}</p>
        <div className="w-full max-w-xs">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/70">
            <div
              className="h-full rounded-full bg-plum transition-all duration-1000 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-[0.65rem] uppercase tracking-[0.15em] text-plum-soft">
            {pct}% · {elapsed}s
          </p>
        </div>
      </div>
    </div>
  );
}

const SEVERITY_DOT: Record<FaceAnnotation["severity"], string> = {
  low: "bg-[#5bb98b]",
  moderate: "bg-[#6B9FA4]",
  notable: "bg-[#e0556f]",
};

const SEVERITY_LABEL: Record<FaceAnnotation["severity"], string> = {
  low: "Minor",
  moderate: "Moderate",
  notable: "Notable",
};

function clampPct(n: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return 50;
  return Math.max(4, Math.min(96, n));
}

export default function AnnotatedFace({
  image,
  annotations,
  mapImage = null,
  mapPending = false,
  onOpen,
}: {
  image: string;
  annotations: FaceAnnotation[];
  mapImage?: string | null;
  mapPending?: boolean;
  onOpen?: (src: string) => void;
}) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="relative overflow-hidden rounded-[1.6rem] border border-white/70 bg-pearl-deep shadow-dew">
        {mapImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mapImage}
            alt="Your professional assessment map"
            className="w-full animate-reveal-blur cursor-zoom-in"
            draggable={false}
            onClick={() => onOpen?.(mapImage)}
          />
        ) : mapPending ? (
          <div className="aspect-square w-full">
            <MapLoader image={image} />
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt="Your photo with assessment points"
              className="w-full"
              draggable={false}
            />
            {annotations.map((a, i) => {
              const isActive = active === i;
              return (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => setActive(isActive ? null : i)}
                  style={{ left: `${clampPct(a.x)}%`, top: `${clampPct(a.y)}%` }}
                  className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold text-white shadow-lg ring-2 ring-white/90 transition ${
                    SEVERITY_DOT[a.severity] ?? "bg-[#6B9FA4]"
                  } ${isActive ? "z-10 scale-125" : "hover:scale-110"}`}
                  aria-label={`${i + 1}. ${a.area}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </>
        )}
      </div>

      <ol className="space-y-2.5">
        {annotations.map((a, i) => {
          const isActive = active === i;
          return (
            <li
              key={i}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={`flex gap-3 rounded-2xl border p-3 transition ${
                isActive
                  ? "border-plum/30 bg-white/80"
                  : "border-white/60 bg-white/40"
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                  SEVERITY_DOT[a.severity] ?? "bg-[#6B9FA4]"
                }`}
              >
                {i + 1}
              </span>
              <div className="text-sm">
                <p className="font-medium text-plum">
                  {a.area}
                  <span className="ml-2 text-[0.6rem] uppercase tracking-[0.12em] text-plum-mute">
                    {SEVERITY_LABEL[a.severity] ?? ""}
                  </span>
                </p>
                <p className="text-plum-soft">{a.concern}</p>
                <p className="mt-1 text-xs font-medium text-[#3a7a80]">
                  Suggested: {a.treatment}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
