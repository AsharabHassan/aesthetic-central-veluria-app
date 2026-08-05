import type { ReactNode } from "react";
import type { VeluriaProduct } from "@/lib/veluria";

const PRODUCT_EXPLANATIONS: Record<string, string> = {
  "silk-skin": "Supports the visible quality of texture, radiance, firmness and elasticity.",
  "ultra-lift": "Targets the appearance of firmness, tone, elasticity and luminosity.",
  "pearl-tone": "Targets visible brightness, clarity and a more uniform-looking tone.",
};

const ALL_PRODUCTS = [
  { name: "Silk Skin", detail: PRODUCT_EXPLANATIONS["silk-skin"] },
  { name: "Ultra Lift", detail: PRODUCT_EXPLANATIONS["ultra-lift"] },
  { name: "Pearl Tone", detail: PRODUCT_EXPLANATIONS["pearl-tone"] },
];

export default function VeluriaEducation({
  programme,
  preservedCount = 0,
  cta,
  report = false,
  clinicName = "Aesthetics Central",
}: {
  programme?: VeluriaProduct[];
  preservedCount?: number;
  cta?: ReactNode;
  report?: boolean;
  clinicName?: string;
}) {
  const products = programme?.length
    ? programme.map((product) => ({
        name: product.name.replace("Veluria ", ""),
        detail: PRODUCT_EXPLANATIONS[product.id],
      }))
    : ALL_PRODUCTS;

  return (
    <div className="overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/55 p-6 text-left backdrop-blur-sm sm:p-8">
      <p className="eyebrow">{report ? "Understand your plan" : "The treatment · Veluria"}</p>
      <h2 className="display mt-2 text-2xl text-plum sm:text-3xl">
        {report ? "Why this Veluria plan matched your scan" : "What Veluria actually is"}
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-plum-soft sm:text-base">
        Veluria is a professional cosmetic bioremodelling range designed to improve
        the <strong className="font-semibold text-plum">visible quality of skin</strong> —
        including texture, firmness, tone, luminosity and vitality. Its purpose is
        fresher-looking skin while preserving your natural features, not changing
        the shape of your face.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["01", "Assess", "A clinician reviews your skin, priorities, medical history and suitability."],
          ["02", "Select", "The appropriate Veluria formula is selected for the skin-quality concerns that can realistically respond."],
          ["03", "Apply", `At ${clinicName}, it may be integrated into a professional microneedling-led protocol when clinically appropriate.`],
        ].map(([number, title, copy]) => (
          <div key={number} className="rounded-2xl border border-white/70 bg-pearl-deep/70 p-4">
            <p className="font-display text-xl text-plum-mute">{number}</p>
            <h3 className="mt-2 text-sm font-semibold text-plum">{title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-plum-soft">{copy}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-serum/15 bg-serum/[0.05] p-4 sm:p-5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-serum">
          {programme?.length ? "Matched to your visible concerns" : "Three targeted formulas"}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {products.map((product) => (
            <div key={product.name}>
              <p className="text-sm font-semibold text-plum">{product.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-plum-soft">{product.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <details className="group mt-5 rounded-2xl border border-white/70 bg-white/45 px-4 py-3.5">
        <summary className="cursor-pointer list-none text-sm font-semibold text-plum marker:hidden">
          <span className="flex items-center justify-between gap-4">
            How is this different from filler or wrinkle-relaxing injections?
            <span className="text-lg font-normal text-plum-mute transition group-open:rotate-45" aria-hidden="true">+</span>
          </span>
        </summary>
        <div className="mt-4 grid gap-3 border-t border-plum/10 pt-4 text-xs leading-relaxed text-plum-soft sm:grid-cols-3">
          <p><strong className="text-plum">Dermal filler</strong><br />Primarily adds or restores volume and contour.</p>
          <p><strong className="text-plum">Wrinkle-relaxing injections</strong><br />Reduce selected muscle movement to soften expression lines.</p>
          <p><strong className="text-plum">Veluria</strong><br />Focuses on the appearance and quality of the skin itself. It may complement other treatments rather than replace them.</p>
        </div>
      </details>

      <p className="mt-4 text-xs leading-relaxed text-plum-mute">
        Results are progressive and individual. The number, spacing and delivery of
        sessions are decided after clinical assessment. Veluria does not diagnose or
        treat skin lesions, active skin disease, visible vessels or structural volume loss.
      </p>

      {report && preservedCount > 0 && (
        <p className="mt-3 rounded-xl bg-gold-soft/45 px-4 py-3 text-xs leading-relaxed text-plum-soft">
          Your preview kept {preservedCount} finding{preservedCount === 1 ? "" : "s"} unchanged because
          {preservedCount === 1 ? " it is" : " they are"} outside this skin-quality treatment’s scope.
        </p>
      )}

      {cta && <div className="mt-6 flex justify-center">{cta}</div>}
    </div>
  );
}
