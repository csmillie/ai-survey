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
