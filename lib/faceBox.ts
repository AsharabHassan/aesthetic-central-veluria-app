/**
 * Finding the face in a photo, so the crop stops being a guess.
 *
 * WHY THIS EXISTS. Nothing in this app knew where the face was. Every crop
 * window is a fraction of the WHOLE FRAME, and the tone lock samples a
 * hard-coded box in the middle of it — both correct only if the face is centred
 * and fills the picture. On a real arm's-length selfie where the face is about
 * 40% of the frame, a 0.38 window is 389px wide against a 293px-wide face, so a
 * "close-up of the under-eye" comes back wider than the whole head, with sofa in
 * it. That is what a client was actually shown.
 *
 * WHY IT ONLY USES A REAL DETECTOR. components/FaceFramer.tsx records that
 * automatic framing was tried once and rejected: a VISION MODEL's bounding
 * boxes were routinely offset and oversized, and seeding the crop from a bad box
 * produces a confidently wrong default, which is worse than no default. That
 * lesson is kept. This uses the browser's native Shape Detection API — an actual
 * face detector, not a language model estimating coordinates — and when it is
 * unavailable or finds nothing it returns null and the manual slider default is
 * left exactly as it was. A wrong box is never invented.
 *
 * Availability is genuinely partial (Chrome on Android has it; Safari does not),
 * so this is an ENHANCEMENT layer, never a dependency. Everything downstream
 * must still work when it returns null.
 */

export interface FaceBox {
  /** Pixels, in the coordinate space of the image passed in. */
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DetectedFace {
  boundingBox: { x: number; y: number; width: number; height: number };
}
type FaceDetectorCtor = new (opts?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => { detect: (src: CanvasImageSource) => Promise<DetectedFace[]> };

function detector(): FaceDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const C = (window as unknown as { FaceDetector?: FaceDetectorCtor })
    .FaceDetector;
  return typeof C === "function" ? C : null;
}

/** True when this browser can actually find a face. */
export function canDetectFaces(): boolean {
  return detector() !== null;
}

/**
 * The largest face in the image, or null.
 *
 * Null is a completely normal outcome — unsupported browser, no face, a face
 * too small or too turned to detect — and every caller must treat it as "carry
 * on without a box", never as an error worth showing anyone.
 */
export async function detectFace(
  source: HTMLImageElement | HTMLCanvasElement,
): Promise<FaceBox | null> {
  const C = detector();
  if (!C) return null;
  try {
    const faces = await new C({ fastMode: false, maxDetectedFaces: 5 }).detect(
      source,
    );
    if (!faces?.length) return null;
    // Largest by area — on a photo containing more than one person, the subject
    // is the one closest to the camera.
    const best = faces
      .map((f) => f.boundingBox)
      .filter((b) => b && b.width > 0 && b.height > 0)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return best
      ? { x: best.x, y: best.y, width: best.width, height: best.height }
      : null;
  } catch {
    // The API exists but threw (some builds reject on certain sources). Same
    // contract as unsupported: no box, no noise.
    return null;
  }
}

/**
 * How tall the face should sit inside the square crop.
 *
 * 0.72 leaves room above the hairline and below the chin, which the jaw and
 * neck zones need — lib/zoneCrop.ts widens to 0.62 of the FRAME for laxity, and
 * that window only contains a jawline if the frame is mostly face to begin with.
 */
const FACE_HEIGHT_IN_CROP = 0.72;

/**
 * Turns a detected face into the framing the cropper should open on.
 *
 * Returns the same {zoom, cx, cy} shape FaceFramer already drives, so the
 * manual controls keep working unchanged on top of it — this only moves the
 * starting point from "a guess about where faces usually are" to "where this
 * face actually is".
 */
export function framingForFace(
  face: FaceBox,
  imageWidth: number,
  imageHeight: number,
): { zoom: number; cx: number; cy: number } {
  const minSide = Math.min(imageWidth, imageHeight);
  // The square we want to end up with, in source pixels.
  const desired = face.height / FACE_HEIGHT_IN_CROP;
  // FaceFramer's slider runs 1-4 and zoom = minSide / cropSide.
  const zoom = Math.min(4, Math.max(1, minSide / desired));

  const faceCx = face.x + face.width / 2;
  // Biased DOWN from the centre of the detected box. Detectors bound the face
  // roughly brow-to-chin, and the lower face — jawline, neck, marionette lines —
  // is where the treatment claims live, so centring on the box alone crops the
  // jaw tight to the edge.
  const faceCy = face.y + face.height * 0.58;

  return {
    zoom,
    cx: faceCx / imageWidth,
    cy: faceCy / imageHeight,
  };
}
