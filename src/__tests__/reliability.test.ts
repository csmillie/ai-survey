import { describe, it, expect } from "vitest";
import {
  computeReliabilityScore,
  computeCoefficientOfVariation,
  type ResponseMetrics,
} from "@/lib/analysis/reliability";

// ---------------------------------------------------------------------------
// Helper to build a perfect response
// ---------------------------------------------------------------------------

function perfectResponse(overrides?: Partial<ResponseMetrics>): ResponseMetrics {
  return {
    hasValidJson: true,
    isEmpty: false,
    isShort: false,
    hasCitations: true,
    latencyMs: 500,
    costUsd: 0.01,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeCoefficientOfVariation
// ---------------------------------------------------------------------------

describe("computeCoefficientOfVariation", () => {
  it("returns 0 for empty array", () => {
    expect(computeCoefficientOfVariation([])).toBe(0);
  });

  it("returns 0 when all values are identical", () => {
    expect(computeCoefficientOfVariation([5, 5, 5, 5])).toBe(0);
  });

  it("returns 0 when mean is 0", () => {
    expect(computeCoefficientOfVariation([0, 0, 0])).toBe(0);
  });

  it("computes CV correctly for varied values", () => {
    const cv = computeCoefficientOfVariation([10, 20, 30]);
    // mean = 20, stdev = sqrt((100+0+100)/3) = sqrt(66.67) ≈ 8.165
    // cv = 8.165 / 20 ≈ 0.408
    expect(cv).toBeCloseTo(0.408, 2);
  });

  it("returns a single-element CV of 0", () => {
    expect(computeCoefficientOfVariation([42])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeReliabilityScore
// ---------------------------------------------------------------------------

describe("computeReliabilityScore", () => {
  it("returns perfect score (10) for ideal responses", () => {
    const responses = [
      perfectResponse(),
      perfectResponse({ latencyMs: 510, costUsd: 0.0105 }),
      perfectResponse({ latencyMs: 490, costUsd: 0.0095 }),
    ];
    const result = computeReliabilityScore(responses);
    expect(result.score).toBeGreaterThan(9.5);
    expect(result.jsonValidRate).toBe(1);
    expect(result.emptyAnswerRate).toBe(0);
    expect(result.shortAnswerRate).toBe(0);
    expect(result.citationRate).toBe(1);
    expect(result.totalResponses).toBe(3);
  });

  it("returns 0 for all-invalid responses", () => {
    const responses = [
      perfectResponse({
        hasValidJson: false,
        isEmpty: true,
        isShort: true,
        hasCitations: false,
        latencyMs: 100,
        costUsd: 0.001,
      }),
      perfectResponse({
        hasValidJson: false,
        isEmpty: true,
        isShort: true,
        hasCitations: false,
        latencyMs: 1000,
        costUsd: 0.1,
      }),
    ];
    const result = computeReliabilityScore(responses);
    expect(result.score).toBe(0);
  });

  it("penalizes mixed failures correctly", () => {
    const responses = [
      perfectResponse({ hasValidJson: false }),
      perfectResponse(),
    ];
    const result = computeReliabilityScore(responses);
    // 50% json valid → penalty = 0.5 * 6.0 = 3.0
    expect(result.jsonValidRate).toBe(0.5);
    expect(result.penaltyBreakdown.jsonInvalid).toBeCloseTo(3.0);
    expect(result.score).toBeLessThan(10);
    expect(result.score).toBeGreaterThan(0);
  });

  it("clamps score at 0 (never negative)", () => {
    const responses = [
      perfectResponse({
        hasValidJson: false,
        isEmpty: true,
        isShort: true,
        hasCitations: false,
        latencyMs: 100,
        costUsd: 0.001,
      }),
      perfectResponse({
        hasValidJson: false,
        isEmpty: true,
        isShort: true,
        hasCitations: false,
        latencyMs: 5000,
        costUsd: 1.0,
      }),
    ];
    const result = computeReliabilityScore(responses);
    expect(result.score).toBe(0);
  });

  it("handles empty input gracefully", () => {
    const result = computeReliabilityScore([]);
    expect(result.score).toBe(0);
    expect(result.totalResponses).toBe(0);
  });

  it("caps latency CV contribution at 1.0", () => {
    // Create very divergent latencies
    const responses = [
      perfectResponse({ latencyMs: 100 }),
      perfectResponse({ latencyMs: 10000 }),
    ];
    const result = computeReliabilityScore(responses);
    expect(result.penaltyBreakdown.latencyVariance).toBeLessThanOrEqual(1.0);
  });
});
