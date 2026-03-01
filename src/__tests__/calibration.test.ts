import { describe, it, expect } from "vitest";
import {
  computeCalibrationScore,
  findOverconfidentModels,
  OVERCONFIDENCE_CONFIDENCE_THRESHOLD,
  OVERCONFIDENCE_AGREEMENT_THRESHOLD,
  type CalibrationInput,
  type OverconfidenceInput,
} from "@/lib/analysis/calibration";

// ---------------------------------------------------------------------------
// computeCalibrationScore
// ---------------------------------------------------------------------------

describe("computeCalibrationScore", () => {
  it("returns score 0 and avgDelta 0 for empty inputs", () => {
    const result = computeCalibrationScore([]);
    expect(result.calibrationScore).toBe(0);
    expect(result.avgDelta).toBe(0);
  });

  it("returns perfect score when confidence matches agreement", () => {
    const inputs: CalibrationInput[] = [
      { confidence: 80, agreementPercent: 0.8 },
      { confidence: 50, agreementPercent: 0.5 },
      { confidence: 100, agreementPercent: 1.0 },
    ];
    const result = computeCalibrationScore(inputs);
    expect(result.calibrationScore).toBeCloseTo(10, 5);
    expect(result.avgDelta).toBeCloseTo(0, 5);
  });

  it("returns low score for high confidence with low agreement", () => {
    const inputs: CalibrationInput[] = [
      { confidence: 90, agreementPercent: 0.1 },
    ];
    const result = computeCalibrationScore(inputs);
    // avgDelta = |90 - 10| = 80, score = 10 - 80/10 = 2
    expect(result.avgDelta).toBeCloseTo(80, 5);
    expect(result.calibrationScore).toBeCloseTo(2, 5);
  });

  it("handles mixed inputs with varying deltas", () => {
    const inputs: CalibrationInput[] = [
      { confidence: 80, agreementPercent: 0.8 }, // delta = 0
      { confidence: 90, agreementPercent: 0.1 }, // delta = 80
    ];
    const result = computeCalibrationScore(inputs);
    // avgDelta = (0 + 80) / 2 = 40, score = 10 - 40/10 = 6
    expect(result.avgDelta).toBeCloseTo(40, 5);
    expect(result.calibrationScore).toBeCloseTo(6, 5);
  });

  it("clamps score to minimum 0", () => {
    const inputs: CalibrationInput[] = [
      { confidence: 100, agreementPercent: 0.0 },
      { confidence: 100, agreementPercent: 0.0 },
    ];
    const result = computeCalibrationScore(inputs);
    // avgDelta = 100, score = 10 - 100/10 = 0
    expect(result.calibrationScore).toBeCloseTo(0, 5);
  });

  it("clamps score to maximum 10", () => {
    const inputs: CalibrationInput[] = [
      { confidence: 50, agreementPercent: 0.5 },
    ];
    const result = computeCalibrationScore(inputs);
    expect(result.calibrationScore).toBeCloseTo(10, 5);
    expect(result.calibrationScore).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// findOverconfidentModels
// ---------------------------------------------------------------------------

describe("findOverconfidentModels", () => {
  it("returns empty array when agreement >= threshold regardless of confidence", () => {
    const responses: OverconfidenceInput[] = [
      { modelName: "gpt-4", confidence: 95 },
      { modelName: "claude-3", confidence: 99 },
    ];
    expect(findOverconfidentModels(responses, OVERCONFIDENCE_AGREEMENT_THRESHOLD)).toEqual([]);
    expect(findOverconfidentModels(responses, 0.8)).toEqual([]);
    expect(findOverconfidentModels(responses, 1.0)).toEqual([]);
  });

  it("returns models with confidence > threshold when agreement below threshold", () => {
    const responses: OverconfidenceInput[] = [
      { modelName: "gpt-4", confidence: 95 },
      { modelName: "claude-3", confidence: 60 },
      { modelName: "gemini", confidence: 85 },
    ];
    const result = findOverconfidentModels(responses, 0.3);
    expect(result).toEqual(["gpt-4", "gemini"]);
  });

  it("returns empty array when no models exceed confidence threshold", () => {
    const responses: OverconfidenceInput[] = [
      { modelName: "gpt-4", confidence: 50 },
      { modelName: "claude-3", confidence: OVERCONFIDENCE_CONFIDENCE_THRESHOLD },
    ];
    const result = findOverconfidentModels(responses, 0.3);
    expect(result).toEqual([]);
  });

  it("skips models with null confidence", () => {
    const responses: OverconfidenceInput[] = [
      { modelName: "gpt-4", confidence: null },
      { modelName: "claude-3", confidence: 95 },
    ];
    const result = findOverconfidentModels(responses, 0.2);
    expect(result).toEqual(["claude-3"]);
  });

  it("returns multiple overconfident models", () => {
    const responses: OverconfidenceInput[] = [
      { modelName: "gpt-4", confidence: 90 },
      { modelName: "claude-3", confidence: 85 },
      { modelName: "gemini", confidence: 95 },
    ];
    const result = findOverconfidentModels(responses, 0.1);
    expect(result).toEqual(["gpt-4", "claude-3", "gemini"]);
  });
});
