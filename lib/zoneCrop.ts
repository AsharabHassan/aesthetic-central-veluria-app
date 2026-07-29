/**
 * The crop window for one concern zone — the single source of truth for that
 * geometry, shared by the browser and the server.
 *
 * WHY IT IS ITS OWN MODULE. lib/canvas.ts owns the same maths, but it builds
 * HTMLCanvasElements and so cannot be imported on the server. The zone route
 * now generates an "after" for exactly the square that ConcernZooms displays,
 * and if those two crops drift apart by even a few pixels the before and after
 * panels stop being the same piece of face — which is the one thing the whole
 * side-by-side format depends on. Pure numbers, imported by both sides.
 */

/** Default side of the crop window as a fraction of the frame. */
export const ZONE_WINDOW = 0.38;

/**
 * The crop window for a given concern, as a fraction of the frame.
 *
 * THE WINDOW MUST CONTAIN THE FEATURE THE CLAIM IS ABOUT, and getting this
 * wrong silently costs the whole effect. At the flat 0.38 every zone used, a
 * jawline crop centred on the chin cut off BOTH jaw angles, so the one line the
 * lift is supposed to redraw was not in the picture: measured, the jawline zone
 * moved a mean absolute 7.0 while under-eye and forehead — features that do fit
 * in 0.38 — moved 11.5 and 12.6. Widened to hold both jaw angles and the top of
 * the neck, the same zone moves like the others.
 *
 * Wider is not free: it is the same trade the full-face pass loses, since every
 * extra pixel of frame is a pixel not spent on the feature. So these are the
 * smallest windows that still contain their anatomy, not generous ones.
 */
export function zoneWindowFor(area: string, concern: string = ""): number {
  const t = `${area} ${concern}`.toLowerCase();
  // The jaw margin runs nearly the full width of the face, and the lift reads
  // as a change in that silhouette against the neck behind it.
  if (/(laxity|lax|sag|firm|elastic|jawline|jowl|slack|contour|lower.face|neck|chin)/.test(t))
    return 0.62;
  // Folds run from nose to chin — a tight square lands mid-fold and shows no end.
  if (/(nasolabial|marionette|perioral|smile line|mouth)/.test(t)) return 0.46;
  return ZONE_WINDOW;
}

export interface CropBox {
  left: number;
  top: number;
  side: number;
}

/**
 * The square region of a `size`x`size` frame centred on (xPct, yPct).
 *
 * The centre is pulled inwards so the window always lies fully inside the
 * frame: a concern near the jaw or the hairline would otherwise crop off the
 * edge and come back padded with blank canvas. Identical clamping to
 * cropRegion() in lib/canvas.ts — deliberately, see above.
 */
export function zoneCropBox(
  size: number,
  xPct: number,
  yPct: number,
  sidePct: number = ZONE_WINDOW,
): CropBox {
  const side = Math.round(size * sidePct);
  const half = side / 2;
  const cx = Math.min(size - half, Math.max(half, (xPct / 100) * size));
  const cy = Math.min(size - half, Math.max(half, (yPct / 100) * size));
  return {
    left: Math.round(cx - half),
    top: Math.round(cy - half),
    side,
  };
}
