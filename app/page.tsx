"use client";

import { useRef, useState } from "react";
import SelfieCapture from "@/components/SelfieCapture";
import LeadForm from "@/components/LeadForm";
import Processing from "@/components/Processing";
import AnalysisReport from "@/components/AnalysisReport";
import VeluriaEducation from "@/components/VeluriaEducation";
import type { SkinAnalysis, LeadPayload, FaceAnnotation, SkinGoal } from "@/lib/types";
import type { GhlMeta } from "@/lib/ghl";
import { concernZones, heroZone, type HeroZone } from "@/lib/hero";
import { cropRegion, loadImage, toSquare } from "@/lib/canvas";
import { zoneWindowFor } from "@/lib/zoneCrop";
import { DISCLAIMER_SHORT } from "@/lib/legal";

type Step = "welcome" | "capture" | "form" | "processing" | "result" | "error";

/**
 * How many areas get a close-up in the reel.
 *
 * No longer a cost lever: close-ups are now cut from the one generated after
 * image, so a fourth costs a canvas crop rather than a billed generation. It is
 * purely an editorial choice — the reel is ordered worst-first, and three
 * unmistakable changes read better than seven faint ones.
 */
const ZONE_LIMIT = Number(process.env.NEXT_PUBLIC_ZONE_LIMIT ?? 3);

/** Generated per-area close-ups, keyed by `area|concern`. */
export type ZonePair = {
  before: string;
  after: string;
  /** Where this crop came from, for compositing back onto the whole face. */
  box?: { left: number; top: number; side: number };
};

function previewProfile(analysis: SkinAnalysis, goals: SkinGoal[]) {
  const annotations: FaceAnnotation[] = [...analysis.annotations];
  const hydrationPriority = goals.includes("Hydration & glow");
  const qualityScores = analysis.categories
    .filter((category) => /(hydration|radiance)/i.test(category.label))
    .map((category) => category.score);
  const visibleQualityRoom = qualityScores.length > 0 && Math.min(...qualityScores) <= 75;

  if (hydrationPriority && visibleQualityRoom) {
    const existingIndex = annotations.findIndex((annotation) =>
      /(hydrat|radiance|dull|glow|luminos)/i.test(`${annotation.area} ${annotation.concern}`),
    );
    if (existingIndex >= 0) {
      const existing = annotations.splice(existingIndex, 1)[0];
      annotations.unshift({
        ...existing,
        severity: "notable",
        imagePrompt:
          "Show a strong but photographic improvement in surface hydration and light reflection across both cheeks: supple, smoother and naturally luminous, with real pores and skin grain still visible and no whitening.",
      });
    } else {
      annotations.unshift({
        x: 50,
        y: 56,
        area: "Cheek hydration & radiance",
        concern: "dull, dehydrated-looking mid-face with reduced surface luminosity",
        treatment:
          "A completed Veluria Silk Skin course can make the skin look visibly more supple, hydrated and luminous while keeping the same natural skin colour.",
        scope: "veluria",
        severity: "notable",
        imagePrompt:
          "Show a strong but photographic improvement in surface hydration and light reflection across both cheeks: supple, smoother and naturally luminous, with real pores and skin grain still visible and no whitening.",
      });
    }
  }

  const afterImagePrompt =
    hydrationPriority && visibleQualityRoom
      ? `${analysis.afterImagePrompt ?? ""}\n\nCLIENT-SELECTED PRIORITY — HYDRATION & GLOW\nMake the completed-course skin-quality change immediately visible: the dull, flat-looking mid-face becomes noticeably more supple, smooth and naturally luminous. Keep real pores and skin grain; keep exactly the same skin colour and depth. This hydration-and-radiance improvement is the first difference a viewer notices.`
      : analysis.afterImagePrompt;

  return { annotations, afterImagePrompt };
}

export default function Home() {
  const [step, setStep] = useState<Step>("welcome");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadPayload | null>(null);
  const [leadMeta, setLeadMeta] = useState<GhlMeta | null>(null);
  const [analysis, setAnalysis] = useState<SkinAnalysis | null>(null);
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [mapPending, setMapPending] = useState(false);
  // The full-face "after" for the slider — ONE gpt-image-2 edit of this photo,
  // briefed by Claude from the analysis. Every close-up in the reel is cut from
  // this same image, so the two can never disagree. See app/api/transform.
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
  /**
   * How many generation checkpoints have landed, driving the wait's progress
   * bar. Real events from the stream, so the bar cannot claim progress the work
   * has not actually made.
   */
  const [previewStage, setPreviewStage] = useState(0);
  /**
   * WHY there is no after image, when there is none.
   *
   * "claim" means the pipeline produced one and refused to publish it: the
   * simulation had cleared something a booster cannot treat. That is a
   * different message from a technical failure, and telling the client the
   * photo was bad when it was not is both wrong and unhelpful.
   */
  const [previewRefusal, setPreviewRefusal] = useState<"claim" | "failed" | null>(null);
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
  /**
   * The analysis, started the moment the photo is confirmed rather than on form
   * submit — so it runs WHILE the client is typing their name.
   *
   * It is ~44s of the wait and it blocks everything after it: the after image
   * cannot start until Claude has written the brief for it. Moving it into the
   * form-filling window removes it from the wait the client actually perceives,
   * and costs nothing extra, because a client who confirms their photo and then
   * abandons the form has only cost us one cheap vision call.
   *
   * Consent is already given at this point: the capture step's checkbox is the
   * one that covers processing the photograph. The form's checkbox covers being
   * contacted, which is a different permission and not one this needs.
   *
   * A ref, not state, because nothing renders from it and a re-render must not
   * restart a running request.
  */
  const analysisPromise = useRef<Promise<SkinAnalysis> | null>(null);
  const leadGoalsRef = useRef<SkinGoal[]>([]);
  /**
   * The After request starts as soon as Claude finishes the photo analysis,
   * while the client is still completing the form. It is the exact same
   * four-candidate request and quality gate; only its start time moves earlier.
   */
  const previewPromise = useRef<Promise<string | null> | null>(null);
  const previewForImage = useRef<string | null>(null);

  const startPreview = (
    image: string,
    analysisResult: SkinAnalysis,
  ): Promise<string | null> => {
    if (previewPromise.current && previewForImage.current === image)
      return previewPromise.current;

    const profile = previewProfile(analysisResult, leadGoalsRef.current);
    const heroArea = heroZone(
      profile.annotations,
      analysisResult.categories,
    );
    const previewPreserve = [
      ...new Set([
        ...(analysisResult.preserve ?? []),
        ...analysisResult.annotations
          .filter((annotation) => annotation.scope === "preserve")
          .map(
            (annotation) =>
              `${annotation.area}: ${annotation.concern} — leave unchanged`,
          ),
      ]),
    ];
    const previewAbort = new AbortController();
    const previewTimeout = window.setTimeout(
      () => previewAbort.abort(),
      245_000,
    );

    setPreviewPending(true);
    setPreviewFailed(false);
    setPreviewStage(0);
    previewForImage.current = image;
    const request = fetch("/api/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: previewAbort.signal,
      body: JSON.stringify({
        image,
        afterImagePrompt: profile.afterImagePrompt,
        preserve: previewPreserve,
        concerns: profile.annotations.map((annotation) => ({
          area: annotation.area,
          concern: annotation.concern,
          scope: annotation.scope,
          x: annotation.x,
          y: annotation.y,
          severity: annotation.severity,
        })),
        hero: heroArea
          ? { area: heroArea.area, concern: heroArea.concern }
          : null,
      }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) return null;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let final: string | null = null;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const line = frame.split("\n").find((item) => item.startsWith("data:"));
            if (!line) continue;
            let message: {
              type?: string;
              image?: string;
              stage?: number;
            };
            try {
              message = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (message.type === "partial") {
              setPreviewStage((stage) => stage + 1);
            } else if (
              message.type === "stage" &&
              typeof message.stage === "number"
            ) {
              setPreviewStage((stage) =>
                Math.max(stage, message.stage ?? stage),
              );
            } else if (message.type === "final" && message.image) {
              final = message.image;
            } else if (message.type === "error") {
              return null;
            }
          }
        }
        return final;
      })
      .catch(() => null)
      .finally(() => window.clearTimeout(previewTimeout));

    request.catch(() => {});
    previewPromise.current = request;
    return request;
  };

  const startAnalysis = (image: string): Promise<SkinAnalysis> => {
    const p = fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Analysis failed.");
      const result = data.analysis as SkinAnalysis;
      // This is the speed win: overlap the expensive image edit with the
      // remaining form-filling time instead of waiting for form submission.
      startPreview(image, result);
      return result;
    });
    // Attach a catch so an early rejection cannot surface as an unhandled
    // rejection while the client is still filling in the form. The real
    // handling happens where the promise is awaited.
    p.catch(() => {});
    analysisPromise.current = p;
    return p;
  };

  const reset = () => {
    reportSent.current = false;
    // Drop any in-flight analysis, or a second run would await the FIRST
    // photo's result and describe skin the client is no longer looking at.
    analysisPromise.current = null;
    leadGoalsRef.current = [];
    previewPromise.current = null;
    previewForImage.current = null;
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
    setPreviewFailed(false);
    if (!previewPromise.current) setPreviewStage(0);

    let analysisResult: SkinAnalysis;
    try {
      // Almost always already finished: it started when the photo was
      // confirmed, and filling the form takes longer than the analysis does.
      // Falls back to starting it here if the client somehow arrived without
      // passing through the capture step.
      analysisResult = await (analysisPromise.current ?? startAnalysis(image));
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
    const profile = previewProfile(
      analysisResult,
      activeLead?.goals ?? leadGoalsRef.current,
    );
    const heroArea = heroZone(
      profile.annotations,
      analysisResult.categories,
    );
    setHero(heroArea);

    const mapZones =
      analysisResult.annotations?.map((a) => ({
        area: a.area,
        severity: a.severity,
      })) ?? [];

    // ONE MASKED GENERATION IS THE RESULT. The close-ups are cut from it.
    //
    // This replaces a pipeline that generated 2-3 tight zone crops and pasted
    // them back onto the client's photograph. That pipeline did what it was
    // designed to do and still failed the client: a zone is ~15% of the frame,
    // so a strong zone edit scoring 16-23 produced a whole-face change of about
    // 2, and clients said their face looked the same. They were right.
    //
    // Cutting the close-ups OUT of the masked after, rather than generating
    // them separately, has a property the old shape could not offer at any
    // price: the reel and the slider are now the same photograph, so a client
    // who compares them can never find them disagreeing. It is also one billed
    // image instead of nine.
    const zoneTargets = concernZones(
      profile.annotations,
      analysisResult.categories,
    ).slice(0, ZONE_LIMIT);
    // Published immediately so the reel can reserve a card per zone — header and
    // real BEFORE panel and all — instead of popping cards in as results land.
    setZoneTargets(zoneTargets);
    setZonePending(zoneTargets.length > 0);
    const previewPreserve = [
      ...new Set([
        ...(analysisResult.preserve ?? []),
        ...analysisResult.annotations
          .filter((annotation) => annotation.scope === "preserve")
          .map(
            (annotation) =>
              `${annotation.area}: ${annotation.concern} — leave unchanged`,
          ),
      ]),
    ];

    // The server has its own shared 240 second budget. This client watchdog is
    // deliberately a little longer: even if a browser or proxy fails to
    // deliver the closing SSE frame, the UI can never remain on "Final pass"
    // forever.
    const previewAbort = new AbortController();
    const previewTimeout = window.setTimeout(
      () => previewAbort.abort(),
      245_000,
    );
    const previewResponse = previewPromise.current
      ? previewPromise.current.then(
          (after) =>
            new Response(
              `data: ${JSON.stringify(
                after
                  ? { type: "final", image: after }
                  : { type: "error" },
              )}\n\n`,
              { headers: { "Content-Type": "text/event-stream" } },
            ),
        )
      : fetch("/api/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: previewAbort.signal,
      body: JSON.stringify({
        image,
        // Claude's own brief, written from this photograph during the analysis.
        afterImagePrompt: profile.afterImagePrompt,
        // Moles, skin tags, rosacea, melasma, active acne, thread veins — the
        // things a booster does not treat, so the picture must not treat them.
        preserve: previewPreserve,
        // Send the whole face analysis, not only the three crops shown in the
        // reel. The server uses this to identify whether the completed
        // programme includes five-session Ultra Lift; limiting it to the reel
        // could silently turn a five-session preview into a three-session one.
        concerns: profile.annotations.map((z) => ({
          area: z.area,
          concern: z.concern,
          scope: z.scope,
          x: z.x,
          y: z.y,
          severity: z.severity,
        })),
        hero: heroArea ? { area: heroArea.area, concern: heroArea.concern } : null,
      }),
        });
    const previewSettled = previewResponse
      // STREAMED. The route emits progressive renders as the model produces
      // them, so the client watches their after photograph resolve from about
      // 10s instead of waiting ~200s to learn whether one is coming. Only the
      // final frame is graded and identity-checked; partials are progress.
      .then(async (r) => {
        if (!r.ok || !r.body) return null;
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let final: string | null = null;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE frames are separated by a blank line. Keep the trailing
          // fragment in the buffer — a frame can straddle two chunks.
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            let msg: {
              type?: string;
              image?: string;
              reason?: string;
              stage?: number;
            };
            try {
              msg = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (msg.type === "partial") {
              // A CHECKPOINT, NOT A PICTURE. The partial's image is deliberately
              // discarded: these are the model's rough drafts, and showing a
              // half-formed face reads as a botched retouch rather than as
              // progress. What it is good for is telling the client, truthfully,
              // that the work moved a step.
              setPreviewStage((s) => s + 1);
            } else if (
              msg.type === "stage" &&
              typeof msg.stage === "number"
            ) {
              setPreviewStage((s) => Math.max(s, msg.stage ?? s));
            } else if (msg.type === "final" && msg.image) {
              final = msg.image;
            } else if (msg.type === "error") {
              setPreviewImage(null);
              // A refusal on CLAIM grounds is not a breakdown — the pipeline
              // worked and declined to publish. The page says so in its own
              // words rather than blaming the photo.
              return null;
            }
          }
        }
        return final;
      })
      .catch(() => null)
      .finally(() => window.clearTimeout(previewTimeout))
      .then(async (after): Promise<{ zone: HeroZone; pair: ZonePair }[]> => {
        if (!after) {
          setPreviewFailed(true);
          setPreviewPending(false);
          setZonePending(false);
          return [];
        }
        setPreviewImage(after);
        setPreviewPending(false);

        // The reel: the same window cut from BOTH frames, so the two panels are
        // guaranteed to be the same piece of face — the one thing a side-by-side
        // comparison cannot get wrong.
        try {
          const [beforeImg, afterImg] = await Promise.all([
            loadImage(image),
            loadImage(after),
          ]);
          const beforeSq = toSquare(beforeImg, 1024);
          const afterSq = toSquare(afterImg, 1024);
          const pairs: Record<string, ZonePair> = {};
          const list: { zone: HeroZone; pair: ZonePair }[] = [];
          for (const z of zoneTargets) {
            const side = zoneWindowFor(z.area, z.concern);
            const pair: ZonePair = {
              before: cropRegion(beforeSq, z.x, z.y, side, 1024).toDataURL("image/jpeg", 0.92),
              after: cropRegion(afterSq, z.x, z.y, side, 1024).toDataURL("image/jpeg", 0.92),
            };
            pairs[`${z.area}|${z.concern}`] = pair;
            list.push({ zone: z, pair });
          }
          setZoneImages(pairs);
          return list;
        } catch {
          // A canvas failure costs the reel, never the slider.
          return [];
        } finally {
          setZonePending(false);
        }
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
    // Waits on the generated after, which is now the source of both the slider
    // and every close-up — an email sent before it existed would carry a report
    // with no evidence in it.
    if (activeLead) {
      Promise.all([previewSettled, mapPromise]).then(([zonePairs, mapImg]) =>
        sendReport(activeLead, analysisResult, image, zonePairs, mapImg),
      );
    }
  };

  const retryPreview = async () => {
    if (!selfie || !analysis || previewPending) return;

    // A failed promise used to stay cached for this photograph, so every
    // apparent retry immediately replayed the same null result. Clear only the
    // preview cache: the completed analysis and captured lead remain intact.
    previewPromise.current = null;
    previewForImage.current = null;
    setPreviewImage(null);
    setPreviewFailed(false);
    setPreviewPending(true);
    setPreviewStage(0);
    setZoneImages({});
    setZonePending(zoneTargets.length > 0);

    const after = await startPreview(selfie, analysis);
    if (!after) {
      setPreviewFailed(true);
      setPreviewPending(false);
      setZonePending(false);
      return;
    }

    setPreviewImage(after);
    setPreviewPending(false);
    try {
      const [beforeImg, afterImg] = await Promise.all([
        loadImage(selfie),
        loadImage(after),
      ]);
      const beforeSq = toSquare(beforeImg, 1024);
      const afterSq = toSquare(afterImg, 1024);
      const pairs: Record<string, ZonePair> = {};
      for (const z of zoneTargets) {
        const side = zoneWindowFor(z.area, z.concern);
        pairs[`${z.area}|${z.concern}`] = {
          before: cropRegion(beforeSq, z.x, z.y, side, 1024).toDataURL(
            "image/jpeg",
            0.92,
          ),
          after: cropRegion(afterSq, z.x, z.y, side, 1024).toDataURL(
            "image/jpeg",
            0.92,
          ),
        };
      }
      setZoneImages(pairs);
    } finally {
      setZonePending(false);
    }
  };

  return (
    <main className="relative min-h-dvh">
      <header className="relative z-10">
        <div className="safe-top mx-auto flex max-w-5xl flex-col items-center justify-center gap-1 px-6">
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

            <div
              className="mx-auto mt-14 max-w-2xl animate-fade-scale"
              style={{ animationDelay: "540ms" }}
            >
              <VeluriaEducation
                cta={
                  <button onClick={() => setStep("capture")} className="btn-ghost">
                    See what may suit my skin
                  </button>
                }
              />
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
                // Kick the analysis off NOW, not on submit. It runs while they
                // type their details, so ~44s comes off the wait they notice.
                startAnalysis(url);
                setStep("form");
              }}
            />
          </section>
        )}

        {step === "form" && selfie && (
          <section key="form" className="w-full animate-fade-scale">
            <LeadForm
              selfie={selfie}
              onGoalsChange={(goals) => {
                leadGoalsRef.current = goals;
              }}
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
            previewStage={previewStage}
            zoneTargets={zoneTargets}
            zoneImages={zoneImages}
            zonePending={zonePending}
            hero={hero}
            analysis={analysis}
            preserve={analysis.preserve}
            email={lead?.email ?? null}
            name={lead?.name ?? null}
            phone={lead?.phone ?? null}
            onRetryPreview={retryPreview}
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
