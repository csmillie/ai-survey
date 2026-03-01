// ---------------------------------------------------------------------------
// Reliability Score — pure computation, no IO
// ---------------------------------------------------------------------------

export interface ResponseMetrics {
  hasValidJson: boolean;
  isEmpty: boolean;
  isShort: boolean;
  hasCitations: boolean;
  latencyMs: number;
  costUsd: number;
}

export interface PenaltyBreakdown {
  jsonInvalid: number;
  emptyAnswer: number;
  shortAnswer: number;
  missingCitations: number;
  latencyVariance: number;
  costVariance: number;
}

export interface ReliabilityResult {
  score: number;
  jsonValidRate: number;
  emptyAnswerRate: number;
  shortAnswerRate: number;
  citationRate: number;
  latencyCv: number;
  costCv: number;
  penaltyBreakdown: PenaltyBreakdown;
  totalResponses: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function computeCoefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;

  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdev = Math.sqrt(variance);

  return stdev / Math.abs(mean);
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

const PENALTY_WEIGHTS = {
  jsonInvalid: 6.0,
  emptyAnswer: 3.0,
  shortAnswer: 2.0,
  missingCitations: 2.0,
  latencyVariance: 1.0,
  costVariance: 1.0,
} as const;

export function computeReliabilityScore(
  responses: ResponseMetrics[]
): ReliabilityResult {
  const n = responses.length;

  if (n === 0) {
    return {
      score: 0,
      jsonValidRate: 0,
      emptyAnswerRate: 0,
      shortAnswerRate: 0,
      citationRate: 0,
      latencyCv: 0,
      costCv: 0,
      penaltyBreakdown: {
        jsonInvalid: 0,
        emptyAnswer: 0,
        shortAnswer: 0,
        missingCitations: 0,
        latencyVariance: 0,
        costVariance: 0,
      },
      totalResponses: 0,
    };
  }

  const jsonValidRate = responses.filter((r) => r.hasValidJson).length / n;
  const emptyAnswerRate = responses.filter((r) => r.isEmpty).length / n;
  // Only count short answers that aren't already empty (avoid double-penalty)
  const shortAnswerRate =
    responses.filter((r) => r.isShort && !r.isEmpty).length / n;
  const citationRate = responses.filter((r) => r.hasCitations).length / n;

  const latencyCv = computeCoefficientOfVariation(
    responses.map((r) => r.latencyMs)
  );
  const costCv = computeCoefficientOfVariation(
    responses.map((r) => r.costUsd)
  );

  const penalties: PenaltyBreakdown = {
    jsonInvalid: (1 - jsonValidRate) * PENALTY_WEIGHTS.jsonInvalid,
    emptyAnswer: emptyAnswerRate * PENALTY_WEIGHTS.emptyAnswer,
    shortAnswer: shortAnswerRate * PENALTY_WEIGHTS.shortAnswer,
    missingCitations: (1 - citationRate) * PENALTY_WEIGHTS.missingCitations,
    latencyVariance: Math.min(latencyCv, 1.0) * PENALTY_WEIGHTS.latencyVariance,
    costVariance: Math.min(costCv, 1.0) * PENALTY_WEIGHTS.costVariance,
  };

  const totalPenalty = Object.values(penalties).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.min(10, 10 - totalPenalty));

  return {
    score,
    jsonValidRate,
    emptyAnswerRate,
    shortAnswerRate,
    citationRate,
    latencyCv,
    costCv,
    penaltyBreakdown: penalties,
    totalResponses: n,
  };
}
