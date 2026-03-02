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

export interface QuestionAgreementData {
  questionId: string;
  questionTitle: string;
  agreementPercent: number;
  outlierModels: string[];
  humanReviewFlag: boolean;
  overconfidentModels: string[];
}

export interface ResponseData {
  id: string;
  questionId: string;
  questionTitle: string;
  questionType: string;
  questionConfig: { scaleMin: number; scaleMax: number } | null;
  modelName: string;
  provider: string;
  answerText: string;
  score: number | null;
  reasoningText: string | null;
  citations: Array<{ url: string; title?: string; snippet?: string }>;
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
  responses: ResponseData[];
}
