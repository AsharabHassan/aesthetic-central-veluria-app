"use client";

import type { ReactNode } from "react";
import type { FaceAnnotation, AnalysisCategory } from "@/lib/types";
import { expectedForArea } from "@/lib/expectations";

const DOT: Record<string, string> = {
  notable: "bg-[#d4574b]",
  moderate: "bg-[#d9a441]",
  low: "bg-[#6fae5f]",
};

/**
 * Shows the before/after slider with a per-area list of the realistic
 * improvement to expect for each flagged area.
 */
export default function AfterCallouts({
  annotations,
  categories,
  children,
}: {
  annotations: FaceAnnotation[];
  categories: AnalysisCategory[];
  children: ReactNode;
}) {
  const items = (annotations ?? []).slice(0, 7);

  return (
    <div>
      {children}

      {items.length > 0 && (
        <ul className="mt-5 space-y-2.5">
          {items.map((a, i) => {
            const expected = expectedForArea(a.area, categories, {
              concern: a.concern,
              treatment: a.treatment,
            });
            return (
              <li
                key={`row-${a.area}-${i}`}
                className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/50 px-4 py-3 backdrop-blur-sm"
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold text-white ${
                    DOT[a.severity] ?? DOT.moderate
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm font-medium text-plum">{a.area}</span>
                    {expected && (
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium ${
                          expected.kind === "consult"
                            ? "bg-[#F7ECDB] text-[#96652a]"
                            : "bg-[#E1EFF0] text-[#3a7a80]"
                        }`}
                      >
                        {expected.kind === "consult"
                          ? expected.label
                          : expected.kind === "softened"
                            ? `Lines ${expected.label}`
                            : `Expected ${expected.label}`}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-plum-soft">{a.concern}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
