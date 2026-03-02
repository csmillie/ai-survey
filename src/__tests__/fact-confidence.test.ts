import { describe, it, expect } from "vitest";
import { computeFactConfidence } from "@/lib/analysis/fact-confidence";
import { compareAcrossModels, extractFactCheckData } from "@/lib/analysis/fact-check";
import type { CrossModelComparison } from "@/lib/analysis/fact-check";

// ---------------------------------------------------------------------------
// Helper: build a comparison result for controlled tests
// ---------------------------------------------------------------------------

function makeComparison(
  overrides: Partial<CrossModelComparison> = {}
): CrossModelComparison {
  return {
    numericDisagreements: [],
    citationOverlap: 0,
    modelsWithCitations: 0,
    totalModels: 3,
    sharedDomains: [],
    agreementSignals: [],
    disagreementSignals: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeFactConfidence
// ---------------------------------------------------------------------------

describe("computeFactConfidence", () => {
  it("returns high confidence when all signals are positive", () => {
    const result = computeFactConfidence({
      agreementPercent: 1.0,
      comparison: makeComparison({
        modelsWithCitations: 3,
        totalModels: 3,
        citationOverlap: 0.8,
        sharedDomains: ["reuters.com"],
        agreementSignals: [
          "consistent numeric claims",
          "all models provided citations",
          "overlapping citation sources",
          "consistent reasoning",
        ],
        disagreementSignals: [],
      }),
      totalModels: 3,
    });
    expect(result.level).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.signals).toContain("strong agreement");
  });

  it("returns low confidence when models disagree", () => {
    const result = computeFactConfidence({
      agreementPercent: 0.3,
      comparison: makeComparison({
        numericDisagreements: [
          {
            claim: "5%",
            values: [
              { modelName: "a", value: 5, raw: "5%" },
              { modelName: "b", value: 3, raw: "3%" },
            ],
            maxDelta: 2,
            meanValue: 4,
          },
        ],
        modelsWithCitations: 0,
        totalModels: 3,
        disagreementSignals: [
          "1 numeric disagreement detected",
          "no models provided citations",
        ],
      }),
      totalModels: 3,
    });
    expect(result.level).toBe("low");
    expect(result.score).toBeLessThan(40);
  });

  it("returns medium confidence for partial agreement", () => {
    const result = computeFactConfidence({
      agreementPercent: 0.6,
      comparison: makeComparison({
        modelsWithCitations: 1,
        totalModels: 3,
        disagreementSignals: ["2 models missing citations"],
        agreementSignals: [],
      }),
      totalModels: 3,
    });
    expect(result.level).toBe("medium");
  });

  it("penalizes single-model responses", () => {
    const result = computeFactConfidence({
      agreementPercent: 1.0,
      comparison: makeComparison({
        totalModels: 1,
        modelsWithCitations: 1,
      }),
      totalModels: 1,
    });
    // Even with perfect "agreement" (only one model), confidence should not be too high
    expect(result.score).toBeLessThan(80);
    expect(result.signals).toContain("single model response");
  });

  it("boosts score for overlapping citation sources", () => {
    const base = computeFactConfidence({
      agreementPercent: 0.75,
      comparison: makeComparison({
        modelsWithCitations: 2,
        totalModels: 2,
        citationOverlap: 0,
        sharedDomains: [],
        agreementSignals: ["all models provided citations"],
      }),
      totalModels: 2,
    });

    const boosted = computeFactConfidence({
      agreementPercent: 0.75,
      comparison: makeComparison({
        modelsWithCitations: 2,
        totalModels: 2,
        citationOverlap: 0.8,
        sharedDomains: ["reuters.com"],
        agreementSignals: [
          "all models provided citations",
          "overlapping citation sources",
        ],
      }),
      totalModels: 2,
    });

    expect(boosted.score).toBeGreaterThan(base.score);
  });

  it("score is always between 0 and 100", () => {
    // Worst case scenario
    const worstCase = computeFactConfidence({
      agreementPercent: 0,
      comparison: makeComparison({
        numericDisagreements: [
          { claim: "a", values: [], maxDelta: 100, meanValue: 50 },
          { claim: "b", values: [], maxDelta: 200, meanValue: 100 },
          { claim: "c", values: [], maxDelta: 300, meanValue: 150 },
        ],
        modelsWithCitations: 0,
        totalModels: 5,
        disagreementSignals: ["many issues"],
      }),
      totalModels: 5,
    });
    expect(worstCase.score).toBeGreaterThanOrEqual(0);
    expect(worstCase.score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Integration: fact-check + fact-confidence together
// ---------------------------------------------------------------------------

describe("fact-check + fact-confidence integration", () => {
  it("produces high confidence for agreeing models", () => {
    const models = [
      {
        modelName: "gpt-4",
        factCheck: extractFactCheckData(
          "The current federal funds rate is 5.25% as reported by the Federal Reserve.",
          [{ url: "https://federalreserve.gov/rates" }]
        ),
      },
      {
        modelName: "claude-3",
        factCheck: extractFactCheckData(
          "According to the Federal Reserve, the federal funds rate stands at 5.25 percent.",
          [{ url: "https://federalreserve.gov/policy" }]
        ),
      },
      {
        modelName: "gemini",
        factCheck: extractFactCheckData(
          "The federal funds rate is currently 5.25%, per Fed data.",
          [{ url: "https://federalreserve.gov/data" }]
        ),
      },
    ];

    const comparison = compareAcrossModels(models);
    const confidence = computeFactConfidence({
      agreementPercent: 0.95,
      comparison,
      totalModels: 3,
    });

    expect(confidence.level).toBe("high");
  });

  it("produces low confidence for disagreeing models", () => {
    const models = [
      {
        modelName: "gpt-4",
        factCheck: extractFactCheckData(
          "The unemployment rate is 3.7% according to recent data.",
          []
        ),
      },
      {
        modelName: "claude-3",
        factCheck: extractFactCheckData(
          "Unemployment stands at 4.2% based on recent reports.",
          []
        ),
      },
    ];

    const comparison = compareAcrossModels(models);
    const confidence = computeFactConfidence({
      agreementPercent: 0.4,
      comparison,
      totalModels: 2,
    });

    expect(confidence.level).toBe("low");
  });
});
