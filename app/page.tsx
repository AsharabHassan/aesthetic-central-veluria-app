"use client";

import { useRef, useState } from "react";
import SelfieCapture from "@/components/SelfieCapture";
import LeadForm from "@/components/LeadForm";
import Processing from "@/components/Processing";
import AnalysisReport from "@/components/AnalysisReport";
import type { SkinAnalysis, LeadPayload } from "@/lib/types";
import type { GhlMeta } from "@/lib/ghl";
import { concernZones, heroZone, type HeroZone } from "@/lib/hero";
import { DISCLAIMER_SHORT } from "@/lib/legal";

type Step = "welcome" | "capture" | "form" | "processing" | "result" | "error";

/**
 * How many areas get their own generated close-up.
 *
 * Each is a separate ~60s generation billed on its own, so this is a real cost
 * lever. Three is chosen over "all of them": the reel is ordered worst-first,
 * so three covers the concerns the client actually came in with, and a page of
 * three unmistakable changes converts better than seven faint ones.
 */
const ZONE_LIMIT = Number(process.env.NEXT_PUBLIC_ZONE_LIMIT ?? 3);

/** Generated per-area close-ups, keyed by `area|concern`. */
export type ZonePair = {
  before: string;
  after: string;
  /** Where this crop came from, for compositing back onto the whole face. */
  box?: { left: number; top: number; side: number };
};

export default function Home() {
  const [step, setStep] = useState<Step>("welcome");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadPayload | null>(null);
  const [leadMeta, setLeadMeta] = useState<GhlMeta | null>(null);
  const [analysis, setAnalysis] = useState<SkinAnalysis | null>(null);
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [mapPending, setMapPending] = useState(false);
  // The full-face "after" for the slider — the generated close-ups composited
  // back onto this photo, plus the deterministic skin grade as a guaranteed
  // floor. Deliberately NOT one full-face generation: see lib/compose.ts.
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  /**
   * The full-face pass finished and produced nothing.
   *
   * Tracked separately from `previewImage === null` because the two used to be
   * indistinguishable, and the report rendered the same empty space for "still
   * working", "never ran" and "failed". A blank gap where a before/after should
   * be is the single most confusing thing this page can do.
   */
  const [previewFailed, setPreviewFailed] = useState(false);
  const [zoneImages, setZoneImages] = useState<Record<string, ZonePair>>({});
  // The zones we are GOING to generate, published as soon as the analysis lands
  // so the reel can reserve a card each — real header, real before panel — and
  // fill the right-hand side in as results arrive, instead of popping whole
  // cards into a page the client is already scrolling.
  const [zoneTargets, setZoneTargets] = useState<HeroZone[]>([]);
  const [zonePending, setZonePending] = useState(false);
  // The single area the preview leads on — see lib/hero.ts. Held here rather
  // than recomputed in the report so the image and the on-page zoom are
  // guaranteed to be talking about the same part of the face.
  const [hero, setHero] = useState<HeroZone | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  // Guards the one-shot report delivery so a given analysis emails the PDF once.
  const reportSent = useRef(false);

  const reset = () => {
    reportSent.current = false;
    setSelfie(null);
    setLead(null);
    setLeadMeta(null);
    setAnalysis(null);
    setMapImage(null);
    setMapPending(false);
    setPreviewImage(null);
    setPreviewPending(false);
    setZoneImages({});
    setZoneTargets([]);
    setZonePending(false);
    setHero(null);
    setErrorMsg("");
    setStep("welcome");
  };

  /**
   * The per-area close-ups, each generated on its own tight crop.
   *
   * Keyed by area|concern so a zone's pair can be looked up without depending
   * on list order. See app/api/zone/route.ts for why these are generated
   * separately instead of being cropped out of the full-face image.
   */
  const fetchZone = (image: string, zone: HeroZone) =>
    fetch("/api/zone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image,
        zone: {
          area: zone.area,
          concern: zone.concern,
          x: zone.x,
          y: zone.y,
          // Written by Claude during the analysis, from the actual photograph.
          imagePrompt: zone.imagePrompt,
        },
      }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        return r.ok && d.before && d.after
          ? {
              before: d.before as string,
              after: d.after as string,
              // Carried so the close-up can be pasted back onto the whole face.
              box: d.box as ZonePair["box"],
            }
          : null;
      })
      .catch(() => null);

  // Build the branded PDF (analysis + before/after + treatment map) in the browser
  // and hand it to /api/report, which uploads it to GoHighLevel, attaches it to the
  // contact and emails the client a copy. Fire-and-forget; runs at most once per
  // analysis and never blocks the result reveal.
  const sendReport = async (
    activeLead: LeadPayload,
    analysisResult: SkinAnalysis,
    before: string,
    zonePairs: { zone: HeroZone; pair: ZonePair }[],
    map: string | null,
  ) => {
    if (reportSent.current) return;
    reportSent.current = true;
    try {
      const { analysisReportPdfBase64 } = await import("@/lib/download");
      const pdfBase64 = await analysisReportPdfBase64({
        analysis: analysisResult,
        before,
        zonePairs,
        map,
      });
      const [firstName, ...rest] = activeLead.name.trim().split(/\s+/);
      await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead: {
            firstName: firstName ?? "",
            lastName: rest.join(" "),
            email: activeLead.email,
            phone: activeLead.phone,
          },
          pdfBase64,
        }),
      });
    } catch {
      // Best-effort: the user still has the on-screen report + download button.
      reportSent.current = false;
    }
  };

  const runAnalysis = async (
    image: string,
    leadData?: LeadPayload | null,
    metaData?: GhlMeta | null,
  ) => {
    const activeLead = leadData ?? lead;
    const activeMeta = metaData ?? leadMeta;
    setStep("processing");
    setMapImage(null);
    setPreviewImage(null);
    setZoneImages({});
    setZoneTargets([]);
    setMapPending(true);
    setPreviewPending(true);

    let analysisResult: SkinAnalysis;
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Analysis failed.");
      analysisResult = data.analysis as SkinAnalysis;
      setAnalysis(analysisResult);
      setStep("result");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "We couldn't complete your analysis.",
      );
      setStep("error");
      return;
    }

    if (activeLead) {
      fetch("/api/lead/concerns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...activeLead,
          analysis: analysisResult,
          meta: activeMeta ?? undefined,
        }),
      }).catch(() => {});
    }

    // The headline area. It no longer orders any prompt — it survives because
    // the booking link carries it as `focus` and every funnel event reports it.
    const heroArea = heroZone(
      analysisResult.annotations,
      analysisResult.categories,
    );
    setHero(heroArea);

    const mapZones =
      analysisResult.annotations?.map((a) => ({
        area: a.area,
        severity: a.severity,
      })) ?? [];

    // THE CLOSE-UPS ARE NOW THE WHOLE PREVIEW.
    //
    // There used to be a full-face generation here as well, shown in a
    // before/after slider. It is gone, and the measurements are the reason.
    // `images.edit` re-renders the entire frame, so at full-face scale any one
    // area is a few hundred pixels and the model treats it as texture rather
    // than structure: the jaw region moved a mean absolute 11.1 / 11.5 / 10.5
    // across three prompt variants and came back visually identical every time.
    // On a dark real-world photo the whole-frame change fell to ~4.5, most of
    // which was background. The SAME region, cropped out and generated on its
    // own at a full 1024px, moved 29.7 and came back genuinely changed.
    //
    // The variable was never the wording — six prompt rewrites in this repo's
    // history say so. It is how many pixels the region gets.
    const zoneTargets = concernZones(
      analysisResult.annotations,
      analysisResult.categories,
    ).slice(0, ZONE_LIMIT);
    // Published so the reel can reserve a card per zone immediately, header and
    // real BEFORE panel and all, instead of popping cards in as results land.
    setZoneTargets(zoneTargets);
    setZonePending(zoneTargets.length > 0);

    const zonesSettled = Promise.all(
      zoneTargets.map((z) =>
        fetchZone(image, z).then((pair) => {
          // Land each one as it arrives rather than waiting for the slowest, so
          // the reel fills in progressively instead of appearing all at once.
          if (pair) {
            setZoneImages((prev) => ({ ...prev, [`${z.area}|${z.concern}`]: pair }));
          }
          return pair ? { zone: z, pair } : null;
        }),
      ),
    ).then((rs) => rs.filter((r): r is NonNullable<typeof r> => r !== null));
    void zonesSettled.finally(() => setZonePending(false));

    // THE FULL-FACE "AFTER", ASSEMBLED FROM THE CLOSE-UPS.
    //
    // Not generated. A single full-face pass measurably changes nothing — the
    // jaw moved ~11 across three prompt variants and looked identical every
    // time — which is why the slider was removed twice. The close-ups DO work:
    // each is generated on its own 1024px crop and scores 16-23. So the
    // whole-face result is those close-ups pasted back onto the client's own
    // photograph, masked to the skin of the face by the landmark service.
    //
    // Two properties follow, and they are the ones the generated version could
    // never deliver: the base is their own pixels so it overlays exactly, and
    // the change lands precisely on the areas the analysis flagged rather than
    // being smeared evenly over a whole face.
    //
    // IT RUNS EVEN WITH ZERO PATCHES, which is the fix for the owner seeing no
    // slider at all. It used to bail here when every zone had been rejected, and
    // since the composite was the ONLY thing producing a full-face after, one
    // unlucky run of a lottery (the same crop measures 21.7, 17.6 and 10.5 on
    // identical input) left the page with nothing to compare. /api/compose now
    // grades the face itself as a guaranteed floor, so it always has an answer.
    void zonesSettled
      .then(async (pairs) => {
        const patches = pairs
          .filter((p) => p.pair.box)
          .map((p) => ({ ...p.pair.box!, image: p.pair.after }));
        const r = await fetch("/api/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image,
            patches,
            // Only when a laxity concern was actually matched to Ultra Lift. A
            // client with no laxity must not be shown a firmness result from a
            // product nobody recommended them.
            lift: zoneTargets.some((z) => z.product?.id === "ultra-lift"),
          }),
        });
        return r.ok ? ((await r.json()).image as string) : null;
      })
      .catch(() => null)
      .then((img) => {
        if (img) setPreviewImage(img);
        else setPreviewFailed(true);
        setPreviewPending(false);
      });

    const mapPromise = fetch("/api/map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, areas: mapZones }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        return r.ok ? (d.image as string) : null;
      })
      .catch(() => null)
      .then((mapImg) => {
        if (mapImg) setMapImage(mapImg);
        setMapPending(false);
        return mapImg;
      });

    // Once the close-ups and the map have settled (success or not), generate the
    // branded PDF and deliver it to GHL — so the emailed report matches what the
    // client sees on screen. Fire-and-forget; a missing image just drops out.
    //
    // Waits on the ZONES now, not on a full-face pass: they are the proof, so an
    // email that went out before they existed would carry a report with no
    // evidence in it.
    if (activeLead) {
      Promise.all([zonesSettled, mapPromise]).then(([zonePairs, mapImg]) =>
        sendReport(activeLead, analysisResult, image, zonePairs, mapImg),
      );
    }
  };

  return (
    <main className="relative min-h-dvh">
      <header className="relative z-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-1 px-6 pt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/aesthetics-central-logo.png"
            alt="Aesthetics Central Clinic"
            className="h-14 w-auto sm:h-16"
          />
          <span className="mt-2 font-display text-[1.9rem] leading-none text-plum sm:text-[2.25rem]">
            Aesthetics Central Clinic
          </span>
          <p className="mt-1 text-[0.6rem] uppercase tracking-couture text-plum-mute">
            Regenerative Medicine · Aesthetic Excellence
          </p>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 py-12 sm:py-16">
        {step === "welcome" && (
          <section key="welcome" className="relative mx-auto max-w-2xl text-center">
            <p className="eyebrow animate-fade-scale" style={{ animationDelay: "60ms" }}>
              Complimentary AI Skin Consultation
            </p>
            <h1
              className="display mt-6 animate-fade-scale text-5xl text-plum sm:text-7xl"
              style={{ animationDelay: "140ms" }}
            >
              Reveal the skin
              <br />
              <span className="serum-text italic">you deserve.</span>
            </h1>
            <p
              className="mx-auto mt-7 max-w-md animate-fade-scale text-balance text-plum-soft"
              style={{ animationDelay: "240ms" }}
            >
              One photograph. An expert-grade skin analysis, a professional
              treatment map, and a personalised preview of your results — from{" "}
              <span className="font-medium text-plum">Aesthetics Central Clinic</span>.
            </p>
            <div
              className="mt-10 flex animate-fade-scale flex-col items-center gap-4"
              style={{ animationDelay: "340ms" }}
            >
              <button onClick={() => setStep("capture")} className="btn-serum">
                Begin my analysis
              </button>
              <p className="text-[0.7rem] uppercase tracking-[0.16em] text-plum-mute">
                Under a minute · Processed privately · Never stored
              </p>
              {/* Prominent disclaimer so expectations are set before starting. */}
              <div className="mx-auto mt-2 max-w-md rounded-2xl border border-plum/20 bg-white/60 px-4 py-3">
                <p className="text-xs font-medium leading-relaxed text-plum-soft">
                  <span className="font-semibold text-plum">Please note: </span>
                  {DISCLAIMER_SHORT} Always consult a clinician before any
                  treatment.
                </p>
              </div>
            </div>

            <div
              className="mx-auto mt-14 grid max-w-lg animate-fade-scale grid-cols-3 gap-3"
              style={{ animationDelay: "440ms" }}
            >
              {[
                ["01", "Deep analysis"],
                ["02", "Treatment map"],
                ["03", "Before / after"],
              ].map(([n, label]) => (
                <div key={n} className="glass-soft px-4 py-5 text-center">
                  <p className="font-display text-2xl text-plum-mute">{n}</p>
                  <p className="mt-1 text-[0.65rem] uppercase tracking-[0.14em] text-plum-soft">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {/* Short enzyme / Veluria explainer — a little science on the
                landing page so visitors know what the treatment behind the
                analysis actually is. Kept brief and appearance-level. */}
            <div
              className="mx-auto mt-14 max-w-xl animate-fade-scale rounded-[1.6rem] border border-white/70 bg-white/55 p-6 text-left backdrop-blur-sm sm:p-8"
              style={{ animationDelay: "540ms" }}
            >
              <p className="eyebrow">The science · Veluria</p>
              <h2 className="display mt-2 text-2xl text-plum sm:text-3xl">
                Skin, rebuilt by <span className="serum-text italic">enzymes</span>
              </h2>
              <p className="mt-4 leading-relaxed text-plum-soft">
                Veluria is a professional <strong className="font-medium text-plum">enzyme
                bioremodelling</strong> range. Rather than sitting on the surface, its
                recombinant collagenase enzymes work <em>within</em> your skin — gently
                clearing tired, disorganised collagen and prompting your skin to build
                fresh collagen of its own.
              </p>
              <p className="mt-3 leading-relaxed text-plum-soft">
                Over a short course, the skin looks firmer, smoother and more even —
                rebuilt from within, not simply hydrated on top.
              </p>
            </div>
          </section>
        )}

        {step === "capture" && (
          <section key="capture" className="w-full animate-fade-scale">
            <div className="mb-8 text-center">
              <p className="eyebrow">Step 01 — Your Photograph</p>
              <h2 className="display mt-3 text-4xl text-plum sm:text-5xl">
                Let&rsquo;s see your skin
              </h2>
            </div>
            <SelfieCapture
              onCaptured={(url) => {
                setSelfie(url);
                setStep("form");
              }}
            />
          </section>
        )}

        {step === "form" && selfie && (
          <section key="form" className="w-full animate-fade-scale">
            <LeadForm
              selfie={selfie}
              onSubmitted={(submittedLead, submittedMeta) => {
                setLead(submittedLead);
                setLeadMeta(submittedMeta);
                runAnalysis(selfie, submittedLead, submittedMeta);
              }}
            />
          </section>
        )}

        {step === "processing" && <Processing key="processing" />}

        {step === "result" && analysis && selfie && (
          <AnalysisReport
            key="result"
            before={selfie}
            mapImage={mapImage}
            mapPending={mapPending}
            previewImage={previewImage}
            previewPending={previewPending}
            previewFailed={previewFailed}
            zoneTargets={zoneTargets}
            zoneImages={zoneImages}
            zonePending={zonePending}
            hero={hero}
            analysis={analysis}
            email={lead?.email ?? null}
            name={lead?.name ?? null}
            onRestart={reset}
          />
        )}

        {step === "error" && (
          <section key="error" className="mx-auto max-w-md animate-fade-scale text-center">
            <p className="eyebrow">Something interrupted us</p>
            <h2 className="display mt-3 text-4xl text-plum">Let&rsquo;s try that again</h2>
            <p className="mt-3 text-plum-soft">{errorMsg}</p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <button onClick={() => selfie && runAnalysis(selfie)} className="btn-serum">
                Retry
              </button>
              <button
                onClick={reset}
                className="text-sm text-plum-mute underline-offset-4 hover:text-plum hover:underline"
              >
                Start over
              </button>
            </div>
          </section>
        )}
      </div>

      <footer className={`relative z-10 mx-auto max-w-5xl px-6 text-center text-[0.65rem] uppercase tracking-[0.14em] text-plum-mute/70 ${step === "result" ? "pb-24" : "pb-10"}`}>
        © {new Date().getFullYear()} Aesthetics Central Clinic · Luton · A cosmetic,
        non-diagnostic AI simulation · Not medical advice
      </footer>
    </main>
  );
}
