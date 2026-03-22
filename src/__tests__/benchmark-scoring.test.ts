import { describe, it, expect } from "vitest";
import {
  normalizeToZeroOne,
  applyReverseScoring,
  computeConstructScores,
} from "@/lib/benchmark-scoring";
import type {
  SingleSelectConfig,
  BinaryConfig,
  LikertConfig,
  NumericScaleConfig,
  MatrixLikertConfig,
} from "@/lib/benchmark-types";

describe("normalizeToZeroOne", () => {
  describe("NUMERIC_SCALE", () => {
    const config: NumericScaleConfig = {
      type: "NUMERIC_SCALE",
      min: 0,
      max: 10,
    };

    it("normalizes min value to 0", () => {
      expect(normalizeToZeroOne("NUMERIC_SCALE", 0, config)).toBe(0);
    });

    it("normalizes max value to 1", () => {
      expect(normalizeToZeroOne("NUMERIC_SCALE", 10, config)).toBe(1);
    });

    it("normalizes midpoint to 0.5", () => {
      expect(normalizeToZeroOne("NUMERIC_SCALE", 5, config)).toBe(0.5);
    });

    it("clamps values below min to 0", () => {
      expect(normalizeToZeroOne("NUMERIC_SCALE", -5, config)).toBe(0);
    });

    it("clamps values above max to 1", () => {
      expect(normalizeToZeroOne("NUMERIC_SCALE", 15, config)).toBe(1);
    });

    it("handles string number values", () => {
      expect(normalizeToZeroOne("NUMERIC_SCALE", "7", config)).toBeCloseTo(0.7);
    });

    it("returns null for non-numeric string", () => {
      expect(normalizeToZeroOne("NUMERIC_SCALE", "abc", config)).toBeNull();
    });

    it("handles zero range", () => {
      const zeroRange: NumericScaleConfig = { type: "NUMERIC_SCALE", min: 5, max: 5 };
      expect(normalizeToZeroOne("NUMERIC_SCALE", 5, zeroRange)).toBe(0);
    });
  });

  describe("categorical types with numericValue", () => {
    const config: LikertConfig = {
      type: "LIKERT",
      points: 5,
      options: [
        { label: "Strongly disagree", value: "1", numericValue: 1 },
        { label: "Disagree", value: "2", numericValue: 2 },
        { label: "Neither", value: "3", numericValue: 3 },
        { label: "Agree", value: "4", numericValue: 4 },
        { label: "Strongly agree", value: "5", numericValue: 5 },
      ],
    };

    it("normalizes lowest option to 0", () => {
      expect(normalizeToZeroOne("LIKERT", "1", config)).toBe(0);
    });

    it("normalizes highest option to 1", () => {
      expect(normalizeToZeroOne("LIKERT", "5", config)).toBe(1);
    });

    it("normalizes middle option to 0.5", () => {
      expect(normalizeToZeroOne("LIKERT", "3", config)).toBe(0.5);
    });

    it("returns null for unknown value", () => {
      expect(normalizeToZeroOne("LIKERT", "unknown", config)).toBeNull();
    });
  });

  describe("BINARY type", () => {
    const config: BinaryConfig = {
      type: "BINARY",
      options: [
        { label: "Yes", value: "yes", numericValue: 1 },
        { label: "No", value: "no", numericValue: 0 },
      ],
    };

    it("normalizes yes to 1", () => {
      expect(normalizeToZeroOne("BINARY", "yes", config)).toBe(1);
    });

    it("normalizes no to 0", () => {
      expect(normalizeToZeroOne("BINARY", "no", config)).toBe(0);
    });
  });

  describe("SINGLE_SELECT type", () => {
    const config: SingleSelectConfig = {
      type: "SINGLE_SELECT",
      options: [
        { label: "Very happy", value: "very_happy", numericValue: 3 },
        { label: "Pretty happy", value: "pretty_happy", numericValue: 2 },
        { label: "Not too happy", value: "not_happy", numericValue: 1 },
      ],
    };

    it("normalizes highest to 1", () => {
      expect(normalizeToZeroOne("SINGLE_SELECT", "very_happy", config)).toBe(1);
    });

    it("normalizes lowest to 0", () => {
      expect(normalizeToZeroOne("SINGLE_SELECT", "not_happy", config)).toBe(0);
    });

    it("normalizes middle to 0.5", () => {
      expect(normalizeToZeroOne("SINGLE_SELECT", "pretty_happy", config)).toBe(0.5);
    });
  });

  describe("MATRIX_LIKERT type", () => {
    const config: MatrixLikertConfig = {
      type: "MATRIX_LIKERT",
      stem: "Confidence in institutions",
      options: [
        { label: "A great deal", value: "great_deal", numericValue: 3 },
        { label: "Only some", value: "only_some", numericValue: 2 },
        { label: "Hardly any", value: "hardly_any", numericValue: 1 },
      ],
    };

    it("normalizes highest to 1", () => {
      expect(normalizeToZeroOne("MATRIX_LIKERT", "great_deal", config)).toBe(1);
    });

    it("normalizes lowest to 0", () => {
      expect(normalizeToZeroOne("MATRIX_LIKERT", "hardly_any", config)).toBe(0);
    });
  });

  describe("ordinal fallback (no numericValue)", () => {
    const config: SingleSelectConfig = {
      type: "SINGLE_SELECT",
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
      ],
    };

    it("uses positional index: first=0, last=1", () => {
      expect(normalizeToZeroOne("SINGLE_SELECT", "low", config)).toBe(0);
      expect(normalizeToZeroOne("SINGLE_SELECT", "high", config)).toBe(1);
      expect(normalizeToZeroOne("SINGLE_SELECT", "medium", config)).toBe(0.5);
    });
  });
});

describe("applyReverseScoring", () => {
  it("returns score unchanged when not reversed", () => {
    expect(applyReverseScoring(0.7, false)).toBe(0.7);
  });

  it("flips score when reversed", () => {
    expect(applyReverseScoring(0.7, true)).toBeCloseTo(0.3);
  });

  it("flips 0 to 1", () => {
    expect(applyReverseScoring(0, true)).toBe(1);
  });

  it("flips 1 to 0", () => {
    expect(applyReverseScoring(1, true)).toBe(0);
  });
});

describe("computeConstructScores", () => {
  it("computes mean per construct", () => {
    const results = computeConstructScores([
      { constructKey: "trust", normalizedScore: 0.8, isReversed: false },
      { constructKey: "trust", normalizedScore: 0.6, isReversed: false },
      { constructKey: "happiness", normalizedScore: 0.5, isReversed: false },
    ]);

    expect(results).toHaveLength(2);

    const trust = results.find((r) => r.constructKey === "trust");
    expect(trust).toBeDefined();
    expect(trust!.mean).toBeCloseTo(0.7);
    expect(trust!.count).toBe(2);

    const happiness = results.find((r) => r.constructKey === "happiness");
    expect(happiness).toBeDefined();
    expect(happiness!.mean).toBe(0.5);
    expect(happiness!.count).toBe(1);
  });

  it("applies reverse scoring before averaging", () => {
    const results = computeConstructScores([
      { constructKey: "trust", normalizedScore: 0.8, isReversed: false },
      { constructKey: "trust", normalizedScore: 0.8, isReversed: true }, // becomes 0.2
    ]);

    const trust = results.find((r) => r.constructKey === "trust");
    expect(trust!.mean).toBeCloseTo(0.5); // (0.8 + 0.2) / 2
  });

  it("returns empty array for empty input", () => {
    expect(computeConstructScores([])).toEqual([]);
  });
});
