// ---------------------------------------------------------------------------
// Recommendation Engine — pure computation, no IO
// ---------------------------------------------------------------------------

export interface ModelScore {
  modelTargetId: string;
  modelName: string;
  reliabilityScore: number;
  avgCostUsd: number;
}

export interface QuestionReview {
  questionId: string;
  humanReviewFlag: boolean;
}

export interface Recommendation {
  recommendedModelId: string | null;
  recommendedModelName: string | null;
  reliabilityScore: number | null;
  reason: string;
  humanReviewRequired: boolean;
}

export function computeRecommendation(
  modelScores: ModelScore[],
  questionReviews: QuestionReview[]
): Recommendation {
  if (modelScores.length === 0) {
    return {
      recommendedModelId: null,
      recommendedModelName: null,
      reliabilityScore: null,
      reason: "No model metrics available.",
      humanReviewRequired: true,
    };
  }

  // Sort by reliability DESC, then cost ASC for models within 0.5 points of the leader
  const byReliability = [...modelScores].sort(
    (a, b) => b.reliabilityScore - a.reliabilityScore
  );
  const bestScore = byReliability[0].reliabilityScore;
  const topTier = byReliability.filter(
    (m) => bestScore - m.reliabilityScore <= 0.5
  );
  const sorted = [
    ...topTier.sort((a, b) => a.avgCostUsd - b.avgCostUsd),
    ...byReliability.filter((m) => bestScore - m.reliabilityScore > 0.5),
  ];

  const top = sorted[0];

  // Check if too many questions flagged for review
  const totalQuestions = questionReviews.length;
  const flaggedCount = questionReviews.filter((q) => q.humanReviewFlag).length;
  const flaggedPercent = totalQuestions > 0 ? flaggedCount / totalQuestions : 0;

  if (top.reliabilityScore < 7.0) {
    return {
      recommendedModelId: top.modelTargetId,
      recommendedModelName: top.modelName,
      reliabilityScore: top.reliabilityScore,
      reason: `Best model (${top.modelName}) scored ${top.reliabilityScore.toFixed(1)}/10 — below the 7.0 reliability threshold. Review responses before trusting results.`,
      humanReviewRequired: true,
    };
  }

  if (flaggedPercent >= 0.3) {
    return {
      recommendedModelId: top.modelTargetId,
      recommendedModelName: top.modelName,
      reliabilityScore: top.reliabilityScore,
      reason: `${flaggedCount} of ${totalQuestions} questions (${Math.round(flaggedPercent * 100)}%) flagged for review — high disagreement across models.`,
      humanReviewRequired: true,
    };
  }

  return {
    recommendedModelId: top.modelTargetId,
    recommendedModelName: top.modelName,
    reliabilityScore: top.reliabilityScore,
    reason: `${top.modelName} is the most reliable model with a score of ${top.reliabilityScore.toFixed(1)}/10.`,
    humanReviewRequired: false,
  };
}
