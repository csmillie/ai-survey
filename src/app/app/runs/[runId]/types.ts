// ---------------------------------------------------------------------------
// Shared types for the run detail page and its sub-components
// ---------------------------------------------------------------------------

export interface PenaltyBreakdown {
  jsonInvalid: number;
  emptyAnswer: number;
  shortAnswer: number;
  missingCitations: number;
  latencyVariance: number;
  costVariance: number;
}

export interface ModelMetricData {
  modelTargetId: string;
  modelName: string;
  provider: string;
  reliabilityScore: number;
  jsonValidRate: number;
  emptyAnswerRate: number;
  shortAnswerRate: number;
  citationRate: number;
  latencyCv: number;
  costCv: number;
  calibrationScore: number | null;
  penaltyBreakdown: PenaltyBreakdown;
  totalResponses: number;
}

export interface RecommendationData {
  recommendedModelId: string | null;
  recommendedModelName: string | null;
  reliabilityScore: number | null;
  reason: string;
  humanReviewRequired: boolean;
}

export interface DriftPoint {
  runDate: string;
  models: Record<string, number | undefined>;
}

export type ClaimCategory = "percentage" | "currency" | "year" | "rating" | "month" | "day_of_week" | "full_date";

export interface NumericDisagreementData {
  claim: string;
  category?: ClaimCategory;
  values: Array<{ modelName: string; value: number; raw: string }>;
  maxDelta: number;
  meanValue: number;
}

export interface FactComparisonData {
  numericDisagreements: NumericDisagreementData[];
  citationOverlap: number;
  modelsWithCitations: number;
  totalModels: number;
  sharedDomains: string[];
  agreementSignals: string[];
  disagreementSignals: string[];
}

export interface QuestionAgreementData {
  questionId: string;
  questionTitle: string;
  questionPrompt: string;
  questionOrder: number;
  agreementPercent: number;
  outlierModels: string[];
  humanReviewFlag: boolean;
  overconfidentModels: string[];
  factConfidenceLevel: string | null;
  factConfidenceScore: number | null;
  factConfidenceSignals: string[];
  factComparison: FactComparisonData | null;
}

export interface ResponseData {
  id: string;
  questionId: string;
  questionTitle: string;
  questionPrompt: string;
  questionType: string;
  questionOrder: number;
  questionConfig: { scaleMin: number; scaleMax: number } | null;
  modelName: string;
  provider: string;
  answerText: string;
  score: number | null;
  reasoningText: string | null;
  citations: Array<{ url: string; title?: string; snippet?: string }>;
  confidence: number | null;
  normalizedScore: number | null;
  selectedOptionValue: string | null;
  matrixRowKey: string | null;
  verificationStatus: "UNREVIEWED" | "VERIFIED" | "INACCURATE";
  sentimentScore: number | null;
  costUsd: string | null;
  latencyMs: number | null;
  flags: string[];
  brandMentions: string[];
  institutionMentions: string[];
  entities: {
    people: string[];
    places: string[];
    organizations: string[];
  } | null;
}

export interface DebugData {
  rawText: string;
  requestMessages: Array<{ role: string; content: string }> | null;
  usageJson: { inputTokens: number; outputTokens: number } | null;
}

export interface QuestionGroup {
  questionId: string;
  questionTitle: string;
  questionPrompt: string;
  questionOrder: number;
  responses: ResponseData[];
}

// ---------------------------------------------------------------------------
// Truth Engine types
// ---------------------------------------------------------------------------

export interface TruthBreakdownData {
  baseScore: number;
  consensusBonus: number;
  citationBonus: number;
  citationPenalty: number;
  numericDisagreementPenalty: number;
  assertionDisagreementPenalty: number;
  emptyShortPenalty: number;
  finalScore: number;
}

export interface TruthNumericDisagreementData {
  claimText: string;
  values: Array<{ modelKey: string; value: number; unit?: string }>;
  maxDelta: number;
}

export interface ClaimClusterData {
  clusterId: number;
  kind: "numeric" | "assertion";
  claims: Array<{ kind: string; text: string; modelKey: string }>;
  models: string[];
}

export interface QuestionTruthData {
  questionId: string;
  truthScore: number;
  truthLabel: string;
  consensusPercent: number;
  citationRate: number;
  numericDisagreements: TruthNumericDisagreementData[];
  claimClusters: ClaimClusterData[];
  breakdown: TruthBreakdownData;
}

export interface RefereeDisagreementData {
  type: string;
  description: string;
  models: string[];
  severity: string;
}

export interface RefereeChecklistItemData {
  item: string;
  why: string;
  suggested_source: string;
}

export interface QuestionRefereeData {
  questionId: string;
  refereeModelKey: string;
  summary: string;
  disagreements: RefereeDisagreementData[];
  verifyChecklist: RefereeChecklistItemData[];
  recommendedAnswerModelKey: string | null;
  confidence: number;
}
