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
}

export interface SkinAnalysis {
  summary: string;
  categories: AnalysisCategory[];
  /** Pinned points on the face marking areas to address */
  annotations: FaceAnnotation[];
  veluriaRecommendation: string;
  /** Always present, non-medical disclaimer */
  disclaimer: string;
}
