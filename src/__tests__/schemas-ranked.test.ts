import { describe, it, expect } from "vitest";
import {
  rankedConfigSchema,
  rankedResponseSchema,
  createQuestionSchema,
} from "@/lib/schemas";

describe("rankedConfigSchema", () => {
  it("accepts valid ranked config with 1-5 preset", () => {
    const result = rankedConfigSchema.safeParse({
      scalePreset: "1-5",
      scaleMin: 1,
      scaleMax: 5,
      includeReasoning: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts percentage preset with 0-100 range", () => {
    const result = rankedConfigSchema.safeParse({
      scalePreset: "percentage",
      scaleMin: 0,
      scaleMax: 100,
      includeReasoning: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts custom min/max overriding preset defaults", () => {
    const result = rankedConfigSchema.safeParse({
      scalePreset: "1-5",
      scaleMin: 2,
      scaleMax: 4,
      includeReasoning: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid preset", () => {
    const result = rankedConfigSchema.safeParse({
      scalePreset: "1-50",
      scaleMin: 1,
      scaleMax: 50,
      includeReasoning: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when scaleMin >= scaleMax", () => {
    const result = rankedConfigSchema.safeParse({
      scalePreset: "1-5",
      scaleMin: 5,
      scaleMax: 5,
      includeReasoning: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative scaleMin", () => {
    const result = rankedConfigSchema.safeParse({
      scalePreset: "1-5",
      scaleMin: -1,
      scaleMax: 5,
      includeReasoning: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("rankedResponseSchema", () => {
  it("accepts score only", () => {
    const result = rankedResponseSchema.safeParse({ score: 7 });
    expect(result.success).toBe(true);
  });

  it("accepts score with reasoning", () => {
    const result = rankedResponseSchema.safeParse({
      score: 3,
      reasoning: "Because it was average",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing score", () => {
    const result = rankedResponseSchema.safeParse({
      reasoning: "No score given",
    });
    expect(result.success).toBe(false);
  });
});

describe("createQuestionSchema with type", () => {
  it("accepts OPEN_ENDED type without configJson", () => {
    const result = createQuestionSchema.safeParse({
      title: "Test",
      promptTemplate: "What do you think?",
      type: "OPEN_ENDED",
    });
    expect(result.success).toBe(true);
  });

  it("accepts RANKED type with configJson", () => {
    const result = createQuestionSchema.safeParse({
      title: "Test",
      promptTemplate: "Rate {{brand}}",
      type: "RANKED",
      configJson: {
        scalePreset: "1-10",
        scaleMin: 1,
        scaleMax: 10,
        includeReasoning: true,
      },
    });
    expect(result.success).toBe(true);
  });

  it("defaults type to OPEN_ENDED when omitted", () => {
    const result = createQuestionSchema.safeParse({
      title: "Test",
      promptTemplate: "What do you think?",
    });
    expect(result.success).toBe(true);
  });
});
