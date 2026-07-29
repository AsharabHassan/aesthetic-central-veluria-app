export type SkinGoal =
  | "Hydration & glow"
  | "Fine lines & wrinkles"
  | "Texture & pores"
  | "Tone & redness"
  | "Overall rejuvenation";

export interface LeadPayload {
  name: string;
  email: string;
  phone: string;
  goals: SkinGoal[];
  consent: boolean;
}

export interface AnalysisCategory {
  /** Display label, e.g. "Hydration" */
  label: string;
  /** 0-100 score (higher = healthier) */
  score: number;
  /** Short, supportive observation */
  note: string;
}

export interface FaceAnnotation {
  /** Horizontal position as a percentage of the image width (0-100, from left) */
  x: number;
  /** Vertical position as a percentage of the image height (0-100, from top) */
  y: number;
  /** Aesthetic-medicine area name, e.g. "Nasolabial folds" */
  area: string;
  /** What is visibly observed in that area */
  concern: string;
  /** Suggested treatment direction (Veluria where skin-quality related) */
  treatment: string;
  severity: "low" | "moderate" | "notable";
  /**
   * The image prompt for THIS area's close-up, written by Claude during the
   * analysis rather than assembled from a template here.
   *
   * WHY CLAUDE WRITES IT. Claude has actually looked at the photograph. A
   * template can only say "the texture is smoother"; Claude can say what this
   * person's skin is actually doing — the direction the crepe runs, how the
   * light falls, what shade the skin is — and an image model responds to a
   * specific photographic description far better than to a generic one.
   *
   * Optional: an older analysis, or a model that omits it, falls back to the
   * template in lib/prompts.ts.
   */
  imagePrompt?: string;
}

export interface SkinAnalysis {
  summary: string;
  categories: AnalysisCategory[];
  /** Pinned points on the face marking areas to address */
  annotations: FaceAnnotation[];
  /**
   * Claude's photographic brief for the whole-face "after", written from the
   * client's actual photo. ONE brief for the face, not one per area: the
   * per-area briefs it replaced fed a pipeline that generated small crops and
   * pasted them back, which changed ~15% of the frame and left clients saying
   * their face looked the same. See app/api/transform/route.ts.
   */
  afterImagePrompt?: string;
  veluriaRecommendation: string;
  /** Always present, non-medical disclaimer */
  disclaimer: string;
}
