"use client";

import { useState } from "react";
import type { LeadPayload, SkinGoal } from "@/lib/types";
import type { GhlMeta } from "@/lib/ghl";
import { getFbc, getFbclid, getFbp, newEventId, trackLead } from "@/lib/meta";

const GOALS: SkinGoal[] = [
  "Hydration & glow",
  "Fine lines & wrinkles",
  "Texture & pores",
  "Tone & redness",
  "Overall rejuvenation",
];

export default function LeadForm({
  selfie,
  onSubmitted,
}: {
  selfie: string;
  onSubmitted: (lead: LeadPayload, meta: GhlMeta) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [goals, setGoals] = useState<SkinGoal[]>([]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleGoal = (g: SkinGoal) =>
    setGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const lead: LeadPayload = { name, email, phone, goals, consent };
    // Shared id so the browser Pixel + GHL's server (CAPI) event deduplicate.
    const eventId = newEventId();
    const meta = {
      event_id: eventId,
      event_name: "Lead",
      event_source_url:
        typeof window !== "undefined" ? window.location.href : "",
      fbp: getFbp(),
      fbc: getFbc(),
      fbclid: getFbclid(),
    };
    setSubmitting(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lead, meta }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      // Fire the browser Lead conversion with the same event id.
      trackLead(eventId);
      // Pass meta up so the phase-2 concerns webhook carries the same Meta
      // fields as this lead push.
      onSubmitted(lead, meta);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8 md:grid-cols-[200px_1fr] md:items-start">
      {/* Selfie preview rail */}
      <div className="mx-auto w-40 md:w-full">
        <div className="glass overflow-hidden p-2">
          <div className="overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selfie} alt="Your photo" className="aspect-square w-full object-cover" />
          </div>
        </div>
        <p className="mt-3 text-center text-[0.65rem] uppercase tracking-[0.15em] text-plum-mute">
          Ready to analyse
        </p>
      </div>

      <form onSubmit={submit} className="glass space-y-4 p-6 sm:p-8">
        <div>
          <p className="eyebrow">Step 02 — Your Details</p>
          <h2 className="display mt-2 text-3xl text-plum">
            Where shall we send your results?
          </h2>
          <p className="mt-2 text-sm text-plum-soft">
            Your full analysis, treatment map and personalised preview unlock the moment
            you continue.
          </p>
        </div>

        <input
          className="field"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
        <input
          className="field"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          className="field"
          type="tel"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          required
        />

        <div>
          <p className="mb-2 text-[0.65rem] uppercase tracking-[0.18em] text-plum-soft">
            What matters most to you?
          </p>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => {
              const active = goals.includes(g);
              return (
                <button
                  type="button"
                  key={g}
                  onClick={() => toggleGoal(g)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    active
                      ? "border-transparent bg-plum text-white shadow-sm"
                      : "border-[#E0E0E0] bg-white/70 text-plum-soft hover:border-plum/40"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-start gap-3 text-xs leading-relaxed text-plum-soft">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-plum"
            required
          />
          <span>
            I consent to Aesthetics Central Clinic using my photo
            to generate this analysis and contacting me about treatments. My photo
            is processed to create the result and is not stored.
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" className="btn-serum w-full" disabled={submitting}>
          {submitting ? "Unlocking…" : "Reveal my results"}
        </button>
      </form>
    </div>
  );
}
