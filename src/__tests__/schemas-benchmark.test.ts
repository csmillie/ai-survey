import { describe, it, expect } from "vitest";
import {
  singleSelectConfigSchema,
  binaryConfigSchema,
  forcedChoiceConfigSchema,
  likertConfigSchema,
  numericScaleConfigSchema,
  matrixLikertConfigSchema,
  benchmarkQuestionConfigSchema,
  categoricalResponseSchema,
  numericScaleResponseSchema,
  createQuestionSchema,
  updateQuestionSchema,
} from "@/lib/schemas";

// ---------------------------------------------------------------------------
// Config Schemas
// ---------------------------------------------------------------------------

describe("singleSelectConfigSchema", () => {
  it("accepts valid config with 3 options", () => {
    const result = singleSelectConfigSchema.safeParse({
      type: "SINGLE_SELECT",
      options: [
        { label: "Very happy", value: "very_happy", numericValue: 3 },
        { label: "Pretty happy", value: "pretty_happy", numericValue: 2 },
        { label: "Not too happy", value: "not_happy", numericValue: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts config with allowDontKnow", () => {
    const result = singleSelectConfigSchema.safeParse({
      type: "SINGLE_SELECT",
      options: [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ],
      allowDontKnow: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects fewer than 2 options", () => {
    const result = singleSelectConfigSchema.safeParse({
      type: "SINGLE_SELECT",
      options: [{ label: "Only one", value: "one" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty option labels", () => {
    const result = singleSelectConfigSchema.safeParse({
      type: "SINGLE_SELECT",
      options: [
        { label: "", value: "a" },
        { label: "B", value: "b" },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("binaryConfigSchema", () => {
  it("accepts valid binary config", () => {
    const result = binaryConfigSchema.safeParse({
      type: "BINARY",
      options: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts with reverseScored", () => {
    const result = binaryConfigSchema.safeParse({
      type: "BINARY",
      options: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" },
      ],
      reverseScored: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 2 options", () => {
    const result = binaryConfigSchema.safeParse({
      type: "BINARY",
      options: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" },
        { label: "Maybe", value: "maybe" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 2 options", () => {
    const result = binaryConfigSchema.safeParse({
      type: "BINARY",
      options: [{ label: "Yes", value: "yes" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("forcedChoiceConfigSchema", () => {
  it("accepts valid forced choice config", () => {
    const result = forcedChoiceConfigSchema.safeParse({
      type: "FORCED_CHOICE",
      options: [
        { label: "Most can be trusted", value: "trust" },
        { label: "Can't be too careful", value: "careful" },
      ],
      poleALabel: "Trusting",
      poleBLabel: "Cautious",
    });
    expect(result.success).toBe(true);
  });

  it("works without pole labels", () => {
    const result = forcedChoiceConfigSchema.safeParse({
      type: "FORCED_CHOICE",
      options: [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("likertConfigSchema", () => {
  it("accepts valid 5-point likert", () => {
    const result = likertConfigSchema.safeParse({
      type: "LIKERT",
      points: 5,
      options: [
        { label: "Strongly agree", value: "5", numericValue: 5 },
        { label: "Agree", value: "4", numericValue: 4 },
        { label: "Neither", value: "3", numericValue: 3 },
        { label: "Disagree", value: "2", numericValue: 2 },
        { label: "Strongly disagree", value: "1", numericValue: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid 7-point likert", () => {
    const options = Array.from({ length: 7 }, (_, i) => ({
      label: `Level ${i + 1}`,
      value: String(i + 1),
      numericValue: i + 1,
    }));
    const result = likertConfigSchema.safeParse({
      type: "LIKERT",
      points: 7,
      options,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when points and options count mismatch", () => {
    const result = likertConfigSchema.safeParse({
      type: "LIKERT",
      points: 5,
      options: [
        { label: "Agree", value: "4", numericValue: 4 },
        { label: "Neither", value: "3", numericValue: 3 },
        { label: "Disagree", value: "2", numericValue: 2 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid points value", () => {
    const result = likertConfigSchema.safeParse({
      type: "LIKERT",
      points: 6,
      options: Array.from({ length: 6 }, (_, i) => ({
        label: `Level ${i}`,
        value: String(i),
      })),
    });
    expect(result.success).toBe(false);
  });
});

describe("numericScaleConfigSchema", () => {
  it("accepts valid 0-10 scale", () => {
    const result = numericScaleConfigSchema.safeParse({
      type: "NUMERIC_SCALE",
      min: 0,
      max: 10,
      minLabel: "Worst",
      maxLabel: "Best",
    });
    expect(result.success).toBe(true);
  });

  it("works without labels", () => {
    const result = numericScaleConfigSchema.safeParse({
      type: "NUMERIC_SCALE",
      min: 1,
      max: 7,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when min >= max", () => {
    const result = numericScaleConfigSchema.safeParse({
      type: "NUMERIC_SCALE",
      min: 10,
      max: 10,
    });
    expect(result.success).toBe(false);
  });
});

describe("matrixLikertConfigSchema", () => {
  it("accepts valid config", () => {
    const result = matrixLikertConfigSchema.safeParse({
      type: "MATRIX_LIKERT",
      stem: "How much confidence do you have in:",
      options: [
        { label: "A great deal", value: "great_deal", numericValue: 3 },
        { label: "Only some", value: "only_some", numericValue: 2 },
        { label: "Hardly any", value: "hardly_any", numericValue: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty stem", () => {
    const result = matrixLikertConfigSchema.safeParse({
      type: "MATRIX_LIKERT",
      stem: "",
      options: [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 2 options", () => {
    const result = matrixLikertConfigSchema.safeParse({
      type: "MATRIX_LIKERT",
      stem: "Rate these:",
      options: [{ label: "A", value: "a" }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Discriminated Union
// ---------------------------------------------------------------------------

describe("benchmarkQuestionConfigSchema (discriminated union)", () => {
  it("routes to correct schema by type", () => {
    const single = benchmarkQuestionConfigSchema.safeParse({
      type: "SINGLE_SELECT",
      options: [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ],
    });
    expect(single.success).toBe(true);

    const numeric = benchmarkQuestionConfigSchema.safeParse({
      type: "NUMERIC_SCALE",
      min: 0,
      max: 10,
    });
    expect(numeric.success).toBe(true);
  });

  it("rejects unknown type", () => {
    const result = benchmarkQuestionConfigSchema.safeParse({
      type: "UNKNOWN_TYPE",
      options: [],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

describe("categoricalResponseSchema", () => {
  it("accepts valid response", () => {
    const result = categoricalResponseSchema.safeParse({
      selectedValue: "yes",
      confidence: 85,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing selectedValue", () => {
    const result = categoricalResponseSchema.safeParse({
      confidence: 85,
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence > 100", () => {
    const result = categoricalResponseSchema.safeParse({
      selectedValue: "yes",
      confidence: 150,
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence < 0", () => {
    const result = categoricalResponseSchema.safeParse({
      selectedValue: "yes",
      confidence: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("numericScaleResponseSchema", () => {
  it("accepts valid response", () => {
    const result = numericScaleResponseSchema.safeParse({
      score: 7,
      confidence: 90,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing score", () => {
    const result = numericScaleResponseSchema.safeParse({
      confidence: 90,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Question Schema with Benchmark Types
// ---------------------------------------------------------------------------

describe("createQuestionSchema with benchmark types", () => {
  it("accepts SINGLE_SELECT with valid config", () => {
    const result = createQuestionSchema.safeParse({
      title: "Happiness",
      promptTemplate: "How happy are you?",
      type: "SINGLE_SELECT",
      configJson: {
        type: "SINGLE_SELECT",
        options: [
          { label: "Very happy", value: "very_happy" },
          { label: "Not happy", value: "not_happy" },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects SINGLE_SELECT without configJson", () => {
    const result = createQuestionSchema.safeParse({
      title: "Happiness",
      promptTemplate: "How happy are you?",
      type: "SINGLE_SELECT",
    });
    expect(result.success).toBe(false);
  });

  it("accepts BINARY with valid config", () => {
    const result = createQuestionSchema.safeParse({
      title: "Support",
      promptTemplate: "Do you have support?",
      type: "BINARY",
      configJson: {
        type: "BINARY",
        options: [
          { label: "Yes", value: "yes" },
          { label: "No", value: "no" },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts NUMERIC_SCALE with valid config", () => {
    const result = createQuestionSchema.safeParse({
      title: "Life satisfaction",
      promptTemplate: "Rate your life satisfaction",
      type: "NUMERIC_SCALE",
      configJson: {
        type: "NUMERIC_SCALE",
        min: 0,
        max: 10,
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts MATRIX_LIKERT with valid config", () => {
    const result = createQuestionSchema.safeParse({
      title: "Confidence in institutions",
      promptTemplate: "Rate confidence",
      type: "MATRIX_LIKERT",
      configJson: {
        type: "MATRIX_LIKERT",
        stem: "How much confidence?",
        options: [
          { label: "A great deal", value: "great_deal" },
          { label: "Hardly any", value: "hardly_any" },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("still accepts OPEN_ENDED without configJson", () => {
    const result = createQuestionSchema.safeParse({
      title: "Open",
      promptTemplate: "Tell me",
      type: "OPEN_ENDED",
    });
    expect(result.success).toBe(true);
  });

  it("still accepts RANKED with ranked configJson", () => {
    const result = createQuestionSchema.safeParse({
      title: "Rate",
      promptTemplate: "Rate this",
      type: "RANKED",
      configJson: {
        scalePreset: "0-10",
        scaleMin: 0,
        scaleMax: 10,
        includeReasoning: true,
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts benchmark metadata fields", () => {
    const result = createQuestionSchema.safeParse({
      title: "Trust",
      promptTemplate: "Do you trust?",
      type: "BINARY",
      configJson: {
        type: "BINARY",
        options: [
          { label: "Yes", value: "yes" },
          { label: "No", value: "no" },
        ],
      },
      code: "TRUST1",
      constructKey: "social_trust",
      sourceSurvey: "GSS",
      sourceVariable: "TRUST",
      helpText: "Standard GSS trust question",
      isBenchmarkAnchor: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateQuestionSchema with benchmark types", () => {
  it("rejects LIKERT without configJson", () => {
    const result = updateQuestionSchema.safeParse({
      type: "LIKERT",
    });
    expect(result.success).toBe(false);
  });

  it("accepts partial update without type", () => {
    const result = updateQuestionSchema.safeParse({
      title: "Updated title",
      constructKey: "new_construct",
    });
    expect(result.success).toBe(true);
  });
});
