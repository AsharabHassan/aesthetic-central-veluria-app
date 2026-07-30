"use client";

import type { FaceAnnotation, AnalysisCategory } from "@/lib/types";
import { expectedForArea } from "@/lib/expectations";
import { SEVERITY_DOT } from "@/lib/hero";

/**
 * Shows the before/after slider with a per-area list of where each flagged area
 * can get to.
 *
 * The badge is a DESTINATION ("48 → 68"), not a delta ("+10–20%"). Same number,
 * same calibration, and the reason is the client rather than the maths: a small
 * percentage sitting beside a photograph of your own face reads as "barely
 * worth it", because it describes an increment. A destination describes
 * somewhere to arrive, which is the thing anyone is actually deciding whether
 * to book for. No session count appears — that is the doctor's to say.
 */
export default function AfterCallouts({
  concerns,
  categories,
}: {
  /**
   * THE canonical concern list — already de-duplicated and ordered worst-first
   * by lib/hero.ts. It used to take raw annotations and slice the first seven,
   * which is how one real report rendered two rows both titled "Tear trough /
   * under-eye": one badged "68 → 88" and one badged "Beyond Veluria — consult
   * the clinician", one line apart, for the same area.
   */
  concerns: FaceAnnotation[];
  categories: AnalysisCategory[];
}) {
  const items = concerns.slice(0, 7);

  return (
    <div className="mt-8">
      {items.length > 0 && (
        <ul className="space-y-2.5">
          {items.map((a, i) => {
            const expected = expectedForArea(a.area, categories, {
              concern: a.concern,
              treatment: a.treatment,
              scope: a.scope,
            });
            return (
              <li
                key={`row-${a.area}-${i}`}
                className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/50 px-4 py-3 backdrop-blur-sm"
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold text-white ${
                    SEVERITY_DOT[a.severity] ?? SEVERITY_DOT.moderate
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
                        {expected.label}
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
