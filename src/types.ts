/**
 * StxWatch-MCMG — IESE (Investment Evidence Scoring Engine) v1.0
 * 1COMP — Company Performance / Scoring Model
 *
 * This is the canonical data model for the app. Per CONFLICTS.md, this
 * five-category evidence-based model (established in the chat-thread design
 * session) supersedes the four-factor `CompanyStock` model that shipped in
 * the AI Studio export. The AI Studio export's visual components have been
 * adapted to render this shape instead.
 */

// ── Locked enums (fixed vocabularies, not free text) ──────────────────────

export type TrendArrow = "↑↑" | "↑" | "→" | "↓" | "↓↓";
export const TREND_VALUES: TrendArrow[] = ["↑↑", "↑", "→", "↓", "↓↓"];

export type VerificationRating = "++" | "+" | "○" | "?" | "X";
export const VERIFICATION_VALUES: VerificationRating[] = ["++", "+", "○", "?", "X"];

// ── Core building blocks ───────────────────────────────────────────────────

export interface CompanyRecord {
  ticker: string;
  name: string;
  industry: string;
  market_cap: string;
  price: number;
  price_change_24h: number; // percent, e.g. 2.48 or -1.20
  volume_24h: string;
}

export interface ScoreBlock {
  overall: number; // 0-100
  confidence: number; // 0-100
  trend: TrendArrow;
  verification: VerificationRating;
  evidence_strength: number; // 1-5, rendered as stars
  last_updated: string; // ISO 8601 date
}

export interface Metric {
  name: string;
  value: string;
  score: number; // 0-100
  trend: TrendArrow;
  notes: string;
}

export interface CategoryBlock {
  score: number; // 0-100
  trend: TrendArrow;
  metrics: Metric[];
}

export interface EvidenceItem {
  title: string;
  category: string;
  description: string;
  date: string; // ISO 8601 date
  source: string;
  url: string;
  reliability: number; // 0-100
  verified: boolean;
  independent_sources: number;
  confidence: number; // 0-100
  impact: number; // -100 (bearish) to 100 (bullish)
  expires: string; // ISO 8601 date
}

export interface Summary {
  overall_assessment: string;
  key_risks: string[];
  watch_items: string[];
  next_catalysts: string[];
}

// ── Top-level record ────────────────────────────────────────────────────

export interface CompanyScore {
  company: CompanyRecord;
  score: ScoreBlock;
  categories: {
    demand: CategoryBlock;
    execution: CategoryBlock;
    competition: CategoryBlock;
    financial: CategoryBlock;
    external: CategoryBlock;
  };
  evidence: EvidenceItem[];
  summary: Summary;
}

// ── Fixed scoring weights (engine-level constant, never per-company) ─────

export const SCORING_WEIGHTS = {
  demand: 0.25,
  execution: 0.2,
  competition: 0.2,
  financial: 0.2,
  external: 0.15,
} as const;

export type CategoryKey = keyof typeof SCORING_WEIGHTS;
export const CATEGORY_KEYS: CategoryKey[] = [
  "demand",
  "execution",
  "competition",
  "financial",
  "external",
];

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  demand: "Demand",
  execution: "Execution",
  competition: "Competition",
  financial: "Financial",
  external: "External",
};

/** Recomputes the overall score from category blocks using the fixed weights. */
export function computeOverallScore(categories: CompanyScore["categories"]): number {
  const raw = CATEGORY_KEYS.reduce(
    (sum, key) => sum + categories[key].score * SCORING_WEIGHTS[key],
    0
  );
  return Math.round(raw);
}

// ── Freshness ──────────────────────────────────────────────────────────

export const FRESHNESS = { GREEN: 30, YELLOW: 90 } as const;
export type Freshness = "green" | "yellow" | "red";

export function getFreshness(lastUpdated: string): Freshness {
  const days = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= FRESHNESS.GREEN) return "green";
  if (days <= FRESHNESS.YELLOW) return "yellow";
  return "red";
}

// ── Score / confidence labels (also drive the Business Health Meter) ────

export const SCORE_LABELS = [
  { min: 90, max: 100, label: "Exceptional" },
  { min: 80, max: 89, label: "Strong candidate" },
  { min: 70, max: 79, label: "Positive" },
  { min: 60, max: 69, label: "Neutral" },
  { min: 50, max: 59, label: "Weak" },
  { min: 0, max: 49, label: "High risk" },
] as const;

export const CONFIDENCE_LABELS = [
  { min: 90, max: 100, label: "Extremely reliable" },
  { min: 75, max: 89, label: "Reliable" },
  { min: 60, max: 74, label: "Moderate" },
  { min: 0, max: 59, label: "Requires additional research" },
] as const;

export function getScoreLabel(score: number): string {
  return SCORE_LABELS.find((l) => score >= l.min && score <= l.max)?.label ?? "Unrated";
}

export function getConfidenceLabel(confidence: number): string {
  return (
    CONFIDENCE_LABELS.find((l) => confidence >= l.min && confidence <= l.max)?.label ??
    "Unrated"
  );
}

/**
 * Business Health Meter — derived, not stored. Maps the overall score to a
 * five-state health reading used for the radial meter's color + label.
 * (Resolves the "pending" item from the earlier design session.)
 */
export type HealthState = "excellent" | "strong" | "positive" | "neutral" | "at-risk";

export function getHealthState(score: number): HealthState {
  if (score >= 90) return "excellent";
  if (score >= 80) return "strong";
  if (score >= 70) return "positive";
  if (score >= 60) return "neutral";
  return "at-risk";
}

export const HEALTH_STATE_COLOR: Record<HealthState, string> = {
  excellent: "emerald",
  strong: "blue",
  positive: "sky",
  neutral: "amber",
  "at-risk": "rose",
};

// ── Legacy four-factor model (kept for reference only) ───────────────────
// This was the original AI Studio model. Nothing in the app writes new
// records in this shape anymore — see CONFLICTS.md, item 1.

export interface LegacyStockScoreBreakdown {
  valuation: number;
  growth: number;
  financialHealth: number;
  momentum: number;
}

export interface LegacyStockCatalyst {
  type: "bull" | "bear";
  text: string;
}

export interface LegacyCompanyStock {
  ticker: string;
  name: string;
  price: number;
  change: string;
  score: number;
  trendTier: "Very High" | "High" | "Moderate" | "Low";
  stance: "Buy" | "Strong Buy" | "Hold" | "Sell";
  riskLevel: "Low" | "Medium" | "High" | "Speculative";
  targetPrice: number;
  summary: string;
  breakdown: LegacyStockScoreBreakdown;
  catalysts: LegacyStockCatalyst[];
  lastUpdated: string;
}
