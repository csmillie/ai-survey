import { describe, it, expect } from "vitest";
import {
  categoricalResponseSchema,
  numericScaleResponseSchema,
  benchmarkQuestionConfigSchema,
} from "@/lib/schemas";
import { isCategoricalType, isBenchmarkType } from "@/lib/benchmark-types";
import type { BenchmarkQuestionConfig } from "@/lib/benchmark-types";
import { normalizeToZeroOne as normalizeScore } from "@/lib/benchmark-scoring";

// ---------------------------------------------------------------------------
// Response Parsing Tests (simulating handler logic)
// ---------------------------------------------------------------------------

describe("benchmark response parsing", () => {
  describe("categorical response parsing", () => {
    it("parses valid categorical response", () => {
      const raw = { selectedValue: "yes", confidence: 85 };
      const result = categoricalResponseSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectedValue).toBe("yes");
        expect(result.data.confidence).toBe(85);
      }
    });

    it("rejects response with missing selectedValue", () => {
      const raw = { confidence: 85 };
      const result = categoricalResponseSchema.safeParse(raw);
      expect(result.success).toBe(false);
    });

    it("rejects response with confidence out of range", () => {
      const raw = { selectedValue: "yes", confidence: 150 };
      const result = categoricalResponseSchema.safeParse(raw);
      expect(result.success).toBe(false);
    });
  });

  describe("numeric scale response parsing", () => {
    it("parses valid numeric response", () => {
      const raw = { score: 7, confidence: 90 };
      const result = numericScaleResponseSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBe(7);
      }
    });

    it("rejects response with missing score", () => {
      const raw = { confidence: 90 };
      const result = numericScaleResponseSchema.safeParse(raw);
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Config Validation (simulating handler's safeParse)
// ---------------------------------------------------------------------------

describe("benchmark config validation in handler", () => {
  it("validates SINGLE_SELECT config from JSON", () => {
    const rawConfig = {
      type: "SINGLE_SELECT",
      options: [
        { label: "Very happy", value: "very_happy", numericValue: 3 },
        { label: "Not happy", value: "not_happy", numericValue: 1 },
      ],
    };
    const result = benchmarkQuestionConfigSchema.safeParse(rawConfig);
    expect(result.success).toBe(true);
  });

  it("validates MATRIX_LIKERT config from JSON", () => {
    const rawConfig = {
      type: "MATRIX_LIKERT",
      stem: "Rate these:",
      options: [
        { label: "A great deal", value: "great_deal" },
        { label: "Hardly any", value: "hardly_any" },
      ],
    };
    const result = benchmarkQuestionConfigSchema.safeParse(rawConfig);
    expect(result.success).toBe(true);
  });

  it("rejects invalid config", () => {
    const rawConfig = { type: "SINGLE_SELECT" }; // missing options
    const result = benchmarkQuestionConfigSchema.safeParse(rawConfig);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Normalization stored on response
// ---------------------------------------------------------------------------

describe("normalization stored on LlmResponse", () => {
  it("normalizes categorical selectedValue to 0-1", () => {
    const config: BenchmarkQuestionConfig = {
      type: "LIKERT",
      points: 5,
      options: [
        { label: "SD", value: "1", numericValue: 1 },
        { label: "D", value: "2", numericValue: 2 },
        { label: "N", value: "3", numericValue: 3 },
        { label: "A", value: "4", numericValue: 4 },
        { label: "SA", value: "5", numericValue: 5 },
      ],
    };
    const score = normalizeScore("LIKERT", "5", config);
    expect(score).toBe(1);

    const midScore = normalizeScore("LIKERT", "3", config);
    expect(midScore).toBe(0.5);
  });

  it("normalizes numeric scale score to 0-1", () => {
    const config: BenchmarkQuestionConfig = {
      type: "NUMERIC_SCALE",
      min: 0,
      max: 10,
    };
    const score = normalizeScore("NUMERIC_SCALE", 7, config);
    expect(score).toBeCloseTo(0.7);
  });
});

// ---------------------------------------------------------------------------
// Matrix row enforcement includes row label
// ---------------------------------------------------------------------------

describe("matrix row enforcement", () => {
  it("builds enforcement block with row label", async () => {
    const { buildMatrixLikertRowEnforcement } = await import(
      "@/lib/benchmark-prompts"
    );
    const config = {
      type: "MATRIX_LIKERT" as const,
      stem: "How much confidence do you have?",
      options: [
        { label: "A great deal", value: "great_deal" },
        { label: "Hardly any", value: "hardly_any" },
      ],
    };
    const block = buildMatrixLikertRowEnforcement(config, {
      rowKey: "govt",
      label: "The Federal Government",
    });
    expect(block).toContain("The Federal Government");
    expect(block).toContain("confidence do you have");
    expect(block).toContain("great_deal");
  });
});

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

describe("type guards", () => {
  it("isBenchmarkType identifies benchmark types", () => {
    expect(isBenchmarkType("SINGLE_SELECT")).toBe(true);
    expect(isBenchmarkType("BINARY")).toBe(true);
    expect(isBenchmarkType("MATRIX_LIKERT")).toBe(true);
    expect(isBenchmarkType("OPEN_ENDED")).toBe(false);
    expect(isBenchmarkType("RANKED")).toBe(false);
  });

  it("isCategoricalType identifies categorical types", () => {
    expect(isCategoricalType("SINGLE_SELECT")).toBe(true);
    expect(isCategoricalType("BINARY")).toBe(true);
    expect(isCategoricalType("FORCED_CHOICE")).toBe(true);
    expect(isCategoricalType("LIKERT")).toBe(true);
    expect(isCategoricalType("MATRIX_LIKERT")).toBe(true);
    expect(isCategoricalType("NUMERIC_SCALE")).toBe(false);
    expect(isCategoricalType("OPEN_ENDED")).toBe(false);
    expect(isCategoricalType("RANKED")).toBe(false);
  });

  it("isBenchmarkType covers all 6 benchmark types", () => {
    expect(isBenchmarkType("SINGLE_SELECT")).toBe(true);
    expect(isBenchmarkType("BINARY")).toBe(true);
    expect(isBenchmarkType("FORCED_CHOICE")).toBe(true);
    expect(isBenchmarkType("LIKERT")).toBe(true);
    expect(isBenchmarkType("NUMERIC_SCALE")).toBe(true);
    expect(isBenchmarkType("MATRIX_LIKERT")).toBe(true);
  });
});
