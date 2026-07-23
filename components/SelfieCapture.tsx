"use client";

import { useEffect, useRef, useState } from "react";
import { PHOTO_CONSENT } from "@/lib/legal";
import FaceFramer from "@/components/FaceFramer";

/** Keep the un-cropped source big enough that a tight face crop is still sharp. */
const MAX_SOURCE = 1600;

/**
 * Downscale to a manageable size, preserving the FULL frame.
 *
 * Deliberately no centre-crop here any more: the person then frames their own
 * face in FaceFramer. A photo taken sitting back from the camera is mostly
 * torso, sofa and wall — the pipeline was receiving only a few hundred pixels
 * of actual skin, so the model had almost nothing to improve and the "after"
 * came back looking identical to the "before". Framing, not the prompt, was the
 * reason the preview looked untouched.
 */
async function bitmapToDataUrl(bitmap: ImageBitmap, quality = 0.92): Promise<string> {
  const scale = Math.min(1, MAX_SOURCE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export default function SelfieCapture({
  onCaptured,
}: {
  onCaptured: (dataUrl: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The full-frame photo awaiting framing by the person.
  const [pending, setPending] = useState<string | null>(null);
  // Consent must be given BEFORE any photo is captured or uploaded.
  const [consent, setConsent] = useState(false);
  const [consentNudge, setConsentNudge] = useState(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => () => stopCamera(), []);

  // Attach the stream AFTER the <video> element mounts (cameraOn -> true).
  // Setting srcObject inside startCamera fails because the element isn't in
  // the DOM yet at that point, which leaves the preview black.
  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, [cameraOn]);

  // Gate every capture path on consent. Returns false (and nudges the
  // checkbox) when consent hasn't been given yet.
  const requireConsent = (): boolean => {
    if (consent) return true;
    setConsentNudge(true);
    setError(null);
    return false;
  };

  const startCamera = async () => {
    if (!requireConsent()) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Keep constraints loose — exact width/height can fail (black) on some
        // front cameras. Ask for a square-ish preview but let the device decide.
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera permission was denied. Allow it in your browser settings, or upload a photo instead."
          : name === "NotFoundError"
            ? "No camera was found. Please upload a photo instead."
            : "We couldn't start the camera. Please upload a photo instead.",
      );
    }
  };

  const toFraming = (dataUrl: string) => setPending(dataUrl);

  const snap = async () => {
    const video = videoRef.current;
    if (!video) return;
    // Keep the FULL frame — the person crops it themselves in the next step.
    const frame = document.createElement("canvas");
    frame.width = video.videoWidth;
    frame.height = video.videoHeight;
    const fctx = frame.getContext("2d");
    if (!fctx) return;
    fctx.drawImage(video, 0, 0);
    stopCamera();

    setBusy(true);
    try {
      const bitmap = await createImageBitmap(frame);
      toFraming(await bitmapToDataUrl(bitmap));
    } catch {
      setError("We couldn't read that photo. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Belt-and-braces: the button is disabled without consent, but guard the
    // handler too in case the file dialog was opened another way.
    if (!consent) {
      e.target.value = "";
      setConsentNudge(true);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      toFraming(await bitmapToDataUrl(bitmap));
    } catch {
      setError("We couldn't read that image. Please try another.");
    } finally {
      setBusy(false);
    }
  };

  // Framing step: the photo is taken, now the person crops to their face.
  if (pending) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="glass p-6">
          <FaceFramer
            src={pending}
            onConfirm={(url) => {
              setPending(null);
              onCaptured(url);
            }}
            onRetake={() => setPending(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      {cameraOn ? (
        <div className="glass overflow-hidden p-2">
          <div className="relative overflow-hidden rounded-[1.6rem] bg-plum/90">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-square w-full scale-x-[-1] object-cover"
            />
            {/* framing reticle */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-1/2 h-3/4 w-3/5 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-white/60" />
              <div className="absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-white/70" />
              <div className="absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2 border-white/70" />
              <div className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-white/70" />
              <div className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-white/70" />
            </div>
          </div>
          <div className="flex gap-3 p-3">
            <button onClick={snap} className="btn-serum flex-1">
              Capture
            </button>
            <button onClick={stopCamera} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="glass relative overflow-hidden p-8 text-center">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 animate-blob-morph bg-peach/50 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 animate-blob-morph bg-rose/40 blur-2xl" />
          <div className="relative">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/80 bg-white/60 shadow-dew">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                className="text-plum"
              >
                <path d="M3 7h3l2-2h8l2 2h3v12H3z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </div>
            <p className="display text-3xl text-plum">Add your photo</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-plum-soft">
              We see only what you share — and never keep it.
            </p>

            {/* The after-image can only show a glow the camera actually caught:
                a dim or top-lit selfie hides the very skin quality we simulate,
                so the result looks flat however good the analysis is. */}
            <ul className="mx-auto mt-4 max-w-xs list-disc space-y-1.5 rounded-2xl border border-plum/20 bg-white/60 py-4 pl-9 pr-4 text-left text-xs leading-relaxed text-plum-soft marker:text-plum">
              <li>Face a window or a lamp — light on your face, not behind you.</li>
              <li>Phone at eye level, look straight in, hair off your face.</li>
              <li>Avoid harsh overhead light — it casts shadows that hide your skin.</li>
              <li>No makeup and no filters, for the truest read.</li>
            </ul>

            {/* Consent — required before any photo is captured or uploaded. */}
            <label
              className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 text-left text-xs leading-relaxed transition ${
                consentNudge && !consent
                  ? "border-red-400 bg-red-50/70"
                  : "border-plum/20 bg-white/60"
              }`}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (e.target.checked) setConsentNudge(false);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-plum"
              />
              <span className="text-plum-soft">
                <span className="font-semibold text-plum">Before we begin — </span>
                {PHOTO_CONSENT}
              </span>
            </label>
            {consentNudge && !consent && (
              <p className="mt-2 text-left text-xs font-medium text-red-600">
                Please tick the box above to consent before adding your photo.
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={startCamera}
                className="btn-serum w-full disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy || !consent}
              >
                Use camera
              </button>
              <button
                onClick={() => consent && fileRef.current?.click()}
                className="btn-ghost w-full disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy || !consent}
              >
                {busy ? "Loading…" : "Upload a photo"}
              </button>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={onFile}
          />
        </div>
      )}
      {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
