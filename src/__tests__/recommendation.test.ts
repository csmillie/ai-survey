import { describe, it, expect } from "vitest";
import {
  computeRecommendation,
  type ModelScore,
  type QuestionReview,
} from "@/lib/analysis/recommendation";

function makeScore(overrides?: Partial<ModelScore>): ModelScore {
  return {
    modelTargetId: "model-1",
    modelName: "gpt-4",
    reliabilityScore: 9.0,
    avgCostUsd: 0.01,
    ...overrides,
  };
}

describe("computeRecommendation", () => {
  it("picks clear winner with high reliability", () => {
    const scores: ModelScore[] = [
      makeScore({ modelTargetId: "m1", modelName: "gpt-4", reliabilityScore: 9.5 }),
      makeScore({ modelTargetId: "m2", modelName: "claude-3", reliabilityScore: 7.5 }),
    ];
    const reviews: QuestionReview[] = [
      { questionId: "q1", humanReviewFlag: false },
      { questionId: "q2", humanReviewFlag: false },
    ];

    const result = computeRecommendation(scores, reviews);
    expect(result.recommendedModelId).toBe("m1");
    expect(result.recommendedModelName).toBe("gpt-4");
    expect(result.humanReviewRequired).toBe(false);
  });

  it("flags human review when top score < 7.0", () => {
    const scores: ModelScore[] = [
      makeScore({ modelTargetId: "m1", modelName: "gpt-4", reliabilityScore: 6.5 }),
      makeScore({ modelTargetId: "m2", modelName: "claude-3", reliabilityScore: 5.0 }),
    ];
    const reviews: QuestionReview[] = [
      { questionId: "q1", humanReviewFlag: false },
    ];

    const result = computeRecommendation(scores, reviews);
    expect(result.humanReviewRequired).toBe(true);
    expect(result.reason).toContain("below the 7.0 reliability threshold");
  });

  it("flags human review when >= 30% questions flagged", () => {
    const scores: ModelScore[] = [
      makeScore({ reliabilityScore: 8.0 }),
    ];
    const reviews: QuestionReview[] = [
      { questionId: "q1", humanReviewFlag: true },
      { questionId: "q2", humanReviewFlag: false },
      { questionId: "q3", humanReviewFlag: false },
    ];
    // 1/3 = 33% >= 30%
    const result = computeRecommendation(scores, reviews);
    expect(result.humanReviewRequired).toBe(true);
    expect(result.reason).toContain("flagged for review");
  });

  it("tie-breaks on lower cost within 0.5 reliability", () => {
    const scores: ModelScore[] = [
      makeScore({ modelTargetId: "m1", modelName: "gpt-4", reliabilityScore: 9.0, avgCostUsd: 0.05 }),
      makeScore({ modelTargetId: "m2", modelName: "claude-3", reliabilityScore: 8.8, avgCostUsd: 0.01 }),
    ];
    const reviews: QuestionReview[] = [];

    const result = computeRecommendation(scores, reviews);
    // Within 0.5 points, so should pick cheaper model
    expect(result.recommendedModelId).toBe("m2");
    expect(result.recommendedModelName).toBe("claude-3");
  });

  it("handles single model", () => {
    const scores: ModelScore[] = [
      makeScore({ reliabilityScore: 8.5 }),
    ];
    const reviews: QuestionReview[] = [
      { questionId: "q1", humanReviewFlag: false },
    ];

    const result = computeRecommendation(scores, reviews);
    expect(result.humanReviewRequired).toBe(false);
    expect(result.recommendedModelName).toBe("gpt-4");
  });

  it("handles empty input", () => {
    const result = computeRecommendation([], []);
    expect(result.humanReviewRequired).toBe(true);
    expect(result.recommendedModelId).toBeNull();
  });
});
