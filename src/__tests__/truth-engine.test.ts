import { describe, it, expect } from "vitest";
import {
  extractNumericClaims,
  extractAssertionClaims,
  extractClaims,
} from "@/lib/truth-engine/claim-extraction";
import {
  detectNumericDisagreements,
  clusterAssertions,
  hasStrongAssertionDisagreement,
} from "@/lib/truth-engine/disagreement";
import { computeTruthScore } from "@/lib/truth-engine/scoring";
import type { ExtractedClaim, ModelAnswer } from "@/lib/truth-engine";
import {
  refereeDisagreementsJsonSchema,
  refereeChecklistJsonSchema,
} from "@/lib/schemas";

// ---------------------------------------------------------------------------
// Numeric extraction
// ---------------------------------------------------------------------------

describe("extractNumericClaims", () => {
  it("extracts percentages", () => {
    const claims = extractNumericClaims("The rate is 5.25% for Q1.", "model-a");
    const percents = claims.filter(
      (c) => c.normalized?.unit === "%"
    );
    expect(percents.length).toBeGreaterThanOrEqual(1);
    expect(percents[0].normalized?.value).toBe(5.25);
  });

  it("extracts currency with multiplier ($12k)", () => {
    const claims = extractNumericClaims("Revenue was $12k last quarter.", "model-a");
    const dollars = claims.filter((c) => c.normalized?.unit === "$");
    expect(dollars.length).toBeGreaterThanOrEqual(1);
    expect(dollars[0].normalized?.value).toBe(12000);
  });

  it("extracts plain currency ($1,500.50)", () => {
    const claims = extractNumericClaims("The total cost is $1,500.50.", "model-a");
    const dollars = claims.filter((c) => c.normalized?.unit === "$");
    expect(dollars.length).toBeGreaterThanOrEqual(1);
    expect(dollars[0].normalized?.value).toBeCloseTo(1500.50);
  });

  it("extracts large currency with M/B multiplier", () => {
    const claims = extractNumericClaims("Market cap is $2.5B.", "model-a");
    const dollars = claims.filter((c) => c.normalized?.unit === "$");
    expect(dollars.length).toBeGreaterThanOrEqual(1);
    expect(dollars[0].normalized?.value).toBe(2_500_000_000);
  });

  it("deduplicates by value+unit", () => {
    const claims = extractNumericClaims("Rate is 5% and also 5%.", "model-a");
    const percents = claims.filter((c) => c.normalized?.unit === "%");
    expect(percents.length).toBe(1);
  });

  it("returns empty for text without numbers", () => {
    const claims = extractNumericClaims("This has no numbers.", "model-a");
    expect(claims.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Assertion extraction
// ---------------------------------------------------------------------------

describe("extractAssertionClaims", () => {
  it("extracts up to 3 sentences", () => {
    const text =
      "The economy grew significantly. GDP rose by 3.2 percent year over year. " +
      "Consumer spending was strong. Investment declined slightly.";
    const claims = extractAssertionClaims(text, "model-a");
    expect(claims.length).toBeLessThanOrEqual(3);
    expect(claims[0].kind).toBe("assertion");
    expect(claims[0].modelKey).toBe("model-a");
  });

  it("skips short sentences (< 15 chars)", () => {
    const text = "OK. Yes. The overall growth rate was remarkable.";
    const claims = extractAssertionClaims(text, "model-a");
    expect(claims.length).toBe(1);
    expect(claims[0].text).toContain("growth rate");
  });

  it("returns empty for empty text", () => {
    expect(extractAssertionClaims("", "model-a").length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Combined extraction
// ---------------------------------------------------------------------------

describe("extractClaims", () => {
  it("attaches citations to all claims", () => {
    const claims = extractClaims(
      "Revenue was $12k. The company performed well overall.",
      "model-a",
      ["https://example.com"]
    );
    for (const claim of claims) {
      expect(claim.citations).toContain("https://example.com");
    }
  });
});

// ---------------------------------------------------------------------------
// Numeric disagreement detection
// ---------------------------------------------------------------------------

describe("detectNumericDisagreements", () => {
  it("detects disagreement when values exceed tolerance", () => {
    const claims: ExtractedClaim[] = [
      {
        kind: "numeric",
        text: "Rate is 5%",
        normalized: { value: 5, unit: "%" },
        modelKey: "model-a",
      },
      {
        kind: "numeric",
        text: "Rate is 8%",
        normalized: { value: 8, unit: "%" },
        modelKey: "model-b",
      },
    ];
    const disagreements = detectNumericDisagreements(claims);
    expect(disagreements.length).toBe(1);
    expect(disagreements[0].maxDelta).toBeCloseTo(3);
  });

  it("does not detect disagreement within tolerance (percent ±0.5)", () => {
    const claims: ExtractedClaim[] = [
      {
        kind: "numeric",
        text: "Rate is 5.0%",
        normalized: { value: 5.0, unit: "%" },
        modelKey: "model-a",
      },
      {
        kind: "numeric",
        text: "Rate is 5.3%",
        normalized: { value: 5.3, unit: "%" },
        modelKey: "model-b",
      },
    ];
    const disagreements = detectNumericDisagreements(claims);
    expect(disagreements.length).toBe(0);
  });

  it("does not detect disagreement for currency within 5% relative", () => {
    const claims: ExtractedClaim[] = [
      {
        kind: "numeric",
        text: "Revenue $10,000",
        normalized: { value: 10000, unit: "$" },
        modelKey: "model-a",
      },
      {
        kind: "numeric",
        text: "Revenue $10,400",
        normalized: { value: 10400, unit: "$" },
        modelKey: "model-b",
      },
    ];
    const disagreements = detectNumericDisagreements(claims);
    expect(disagreements.length).toBe(0);
  });

  it("detects currency disagreement beyond tolerance", () => {
    const claims: ExtractedClaim[] = [
      {
        kind: "numeric",
        text: "Revenue $10,000",
        normalized: { value: 10000, unit: "$" },
        modelKey: "model-a",
      },
      {
        kind: "numeric",
        text: "Revenue $15,000",
        normalized: { value: 15000, unit: "$" },
        modelKey: "model-b",
      },
    ];
    const disagreements = detectNumericDisagreements(claims);
    expect(disagreements.length).toBe(1);
  });

  it("returns empty when all claims from same model", () => {
    const claims: ExtractedClaim[] = [
      {
        kind: "numeric",
        text: "5%",
        normalized: { value: 5, unit: "%" },
        modelKey: "model-a",
      },
      {
        kind: "numeric",
        text: "10%",
        normalized: { value: 10, unit: "%" },
        modelKey: "model-a",
      },
    ];
    const disagreements = detectNumericDisagreements(claims);
    expect(disagreements.length).toBe(0);
  });

  it("returns empty for fewer than 2 numeric claims", () => {
    const claims: ExtractedClaim[] = [
      {
        kind: "numeric",
        text: "5%",
        normalized: { value: 5, unit: "%" },
        modelKey: "model-a",
      },
    ];
    expect(detectNumericDisagreements(claims).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Assertion clustering
// ---------------------------------------------------------------------------

describe("clusterAssertions", () => {
  function makeAnswer(modelKey: string, text: string, isEmpty = false): ModelAnswer {
    return { modelKey, text, citations: [], isEmpty, isShort: false };
  }

  it("clusters similar responses together using Jaccard similarity", () => {
    const answers = [
      makeAnswer("model-a", "The economy is growing rapidly with strong consumer demand and robust employment figures"),
      makeAnswer("model-b", "The economy is growing rapidly with strong consumer demand and robust employment figures"),
      makeAnswer("model-c", "Cats and dogs are popular household pets kept by millions of families worldwide"),
    ];
    const { clusters, consensusPercent } = clusterAssertions(answers, 3);
    // model-a and model-b should cluster; model-c should not
    expect(clusters.some((c) => c.models.length >= 2)).toBe(true);
    expect(consensusPercent).toBeGreaterThanOrEqual(2 / 3);
  });

  it("clusters similar but not identical responses", () => {
    const answers = [
      makeAnswer("model-a", "Machine learning and artificial intelligence are transforming modern healthcare delivery systems and patient outcomes"),
      makeAnswer("model-b", "Artificial intelligence and machine learning are transforming modern healthcare delivery practices and patient outcomes"),
    ];
    const { consensusPercent } = clusterAssertions(answers, 2);
    expect(consensusPercent).toBeGreaterThanOrEqual(0.5);
  });

  it("does not cluster responses on completely different topics", () => {
    const answers = [
      makeAnswer("model-a", "The stock market rose sharply driven by technology sector gains and investor optimism"),
      makeAnswer("model-b", "Rainfall patterns shifted dramatically across tropical regions due to ocean temperature changes"),
    ];
    const { consensusPercent } = clusterAssertions(answers, 2);
    expect(consensusPercent).toBeLessThan(1);
  });

  it("handles empty answers array", () => {
    const { clusters, consensusPercent } = clusterAssertions([], 3);
    expect(clusters.length).toBe(0);
    expect(consensusPercent).toBe(1);
  });

  it("excludes isEmpty answers from clustering", () => {
    const answers = [
      makeAnswer("model-a", "The economy is growing", false),
      makeAnswer("model-b", "", true),
    ];
    const { clusters } = clusterAssertions(answers, 2);
    expect(clusters.every((c) => !c.models.includes("model-b"))).toBe(true);
  });
});

describe("hasStrongAssertionDisagreement", () => {
  it("returns true when multiple clusters have >= 2 models", () => {
    const result = hasStrongAssertionDisagreement([
      { clusterId: 0, kind: "assertion", claims: [], models: ["a", "b"] },
      { clusterId: 1, kind: "assertion", claims: [], models: ["c", "d"] },
    ]);
    expect(result).toBe(true);
  });

  it("returns false when only one cluster has >= 2 models", () => {
    const result = hasStrongAssertionDisagreement([
      { clusterId: 0, kind: "assertion", claims: [], models: ["a", "b"] },
      { clusterId: 1, kind: "assertion", claims: [], models: ["c"] },
    ]);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Truth scoring
// ---------------------------------------------------------------------------

describe("computeTruthScore", () => {
  function makeAnswer(overrides: Partial<ModelAnswer> = {}): ModelAnswer {
    return {
      modelKey: "model-a",
      text: "The GDP growth rate was 3.2% in 2024, driven by strong consumer spending.",
      citations: ["https://example.com/report"],
      isEmpty: false,
      isShort: false,
      ...overrides,
    };
  }

  it("returns score 0 for empty answers array", () => {
    const result = computeTruthScore([]);
    expect(result.truthScore).toBe(0);
    expect(result.truthLabel).toBe("LOW");
  });

  it("scores high when all models agree with citations", () => {
    const answers: ModelAnswer[] = [
      makeAnswer({ modelKey: "model-a" }),
      makeAnswer({ modelKey: "model-b" }),
      makeAnswer({ modelKey: "model-c" }),
    ];
    const result = computeTruthScore(answers);
    expect(result.truthScore).toBeGreaterThanOrEqual(55);
    expect(result.citationRate).toBe(1);
  });

  it("penalizes when no citations exist and consensus is low", () => {
    const answers: ModelAnswer[] = [
      makeAnswer({ modelKey: "model-a", citations: [], text: "The stock market rallied strongly on positive earnings data from technology firms" }),
      makeAnswer({ modelKey: "model-b", citations: [], text: "Rainfall across tropical coastal regions declined sharply due to shifting ocean currents" }),
    ];
    const result = computeTruthScore(answers);
    expect(result.breakdown.citationPenalty).toBe(-10);
  });

  it("penalizes numeric disagreements", () => {
    const answers: ModelAnswer[] = [
      makeAnswer({
        modelKey: "model-a",
        text: "The rate is 5% and growing steadily over time.",
      }),
      makeAnswer({
        modelKey: "model-b",
        text: "The rate is 15% and growing steadily over time.",
      }),
    ];
    const result = computeTruthScore(answers);
    expect(result.numericDisagreements.length).toBeGreaterThan(0);
    expect(result.breakdown.numericDisagreementPenalty).toBe(-20);
  });

  it("penalizes empty/short answers", () => {
    const answers: ModelAnswer[] = [
      makeAnswer({ modelKey: "model-a" }),
      makeAnswer({ modelKey: "model-b", isEmpty: true, text: "" }),
    ];
    const result = computeTruthScore(answers);
    expect(result.breakdown.emptyShortPenalty).toBe(-10);
  });

  it("clamps score to 0–100 range", () => {
    // Create a scenario with maximum penalties
    const answers: ModelAnswer[] = [
      makeAnswer({
        modelKey: "model-a",
        text: "Rate is 5%",
        citations: [],
        isShort: true,
      }),
      makeAnswer({
        modelKey: "model-b",
        text: "Rate is 50%",
        citations: [],
        isEmpty: true,
      }),
    ];
    const result = computeTruthScore(answers);
    expect(result.truthScore).toBeGreaterThanOrEqual(0);
    expect(result.truthScore).toBeLessThanOrEqual(100);
  });

  it("labels correctly: HIGH >= 80, MEDIUM 55-79, LOW < 55", () => {
    // All agreeing with citations → should be at least MEDIUM
    const highAnswers: ModelAnswer[] = Array.from({ length: 3 }, (_, i) =>
      makeAnswer({ modelKey: `model-${i}` })
    );
    const highResult = computeTruthScore(highAnswers);
    expect(["HIGH", "MEDIUM"]).toContain(highResult.truthLabel);

    // Numeric disagreement + no citations + empty answer → LOW
    // Score: 50 (base) - 20 (numeric disagree) - 10 (no citations) - 10 (empty) = 10
    const lowAnswers: ModelAnswer[] = [
      makeAnswer({
        modelKey: "a",
        text: "The unemployment rate is 3% across all sectors.",
        citations: [],
      }),
      makeAnswer({
        modelKey: "b",
        text: "The unemployment rate is 25% across all sectors.",
        citations: [],
      }),
      makeAnswer({
        modelKey: "c",
        text: "",
        citations: [],
        isEmpty: true,
      }),
    ];
    const lowResult = computeTruthScore(lowAnswers);
    expect(lowResult.truthLabel).toBe("LOW");
  });

  it("includes full breakdown in result", () => {
    const result = computeTruthScore([makeAnswer()]);
    const bd = result.breakdown;
    expect(bd.baseScore).toBe(50);
    expect(typeof bd.consensusBonus).toBe("number");
    expect(typeof bd.citationBonus).toBe("number");
    expect(typeof bd.citationPenalty).toBe("number");
    expect(typeof bd.numericDisagreementPenalty).toBe("number");
    expect(typeof bd.assertionDisagreementPenalty).toBe("number");
    expect(typeof bd.emptyShortPenalty).toBe("number");
    expect(typeof bd.finalScore).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// Referee JSON parsing (structure validation only — no LLM call)
// ---------------------------------------------------------------------------

describe("referee response validation", () => {
  it("validates well-formed referee JSON", () => {
    const disagreements = [
      {
        type: "numeric" as const,
        description: "GDP growth rate differs",
        models: ["gpt-4", "claude-3"],
        severity: "medium" as const,
      },
    ];

    const checklist = [
      {
        item: "GDP growth rate",
        why: "Core factual claim",
        suggested_source: "official",
      },
    ];

    const parsedDisagreements = refereeDisagreementsJsonSchema.parse(disagreements);
    expect(parsedDisagreements.length).toBe(1);

    const parsedChecklist = refereeChecklistJsonSchema.parse(checklist);
    expect(parsedChecklist.length).toBe(1);
  });

  it("returns empty array for invalid data via .catch()", () => {
    expect(refereeDisagreementsJsonSchema.parse("invalid")).toEqual([]);
    expect(refereeChecklistJsonSchema.parse(123)).toEqual([]);
  });
});
