import { describe, it, expect } from "vitest";
import {
  extractNumericClaims,
  extractDateClaims,
  extractKeySentences,
  analyzeCitations,
  extractFactCheckData,
  compareAcrossModels,
  type ModelFactData,
} from "@/lib/analysis/fact-check";

// ---------------------------------------------------------------------------
// extractNumericClaims
// ---------------------------------------------------------------------------

describe("extractNumericClaims", () => {
  it("extracts percentages", () => {
    const claims = extractNumericClaims("The rate is 5.25% and another is 4.75 percent.");
    const pcts = claims.filter((c) => c.type === "percentage");
    expect(pcts).toHaveLength(2);
    expect(pcts[0].value).toBe(5.25);
    expect(pcts[1].value).toBe(4.75);
  });

  it("extracts currency values", () => {
    const claims = extractNumericClaims("Revenue was $1,234.56 and $2.5 billion.");
    const nums = claims.filter((c) => c.type === "number");
    expect(nums.length).toBeGreaterThanOrEqual(1);
    const currencies = nums.filter((c) => c.raw.includes("$"));
    expect(currencies.length).toBeGreaterThanOrEqual(1);
  });

  it("skips small standalone numbers", () => {
    const claims = extractNumericClaims("There are 3 cats and 5 dogs.");
    // Small numbers (< 10) without multiplier should be skipped
    const nums = claims.filter((c) => c.type === "number");
    expect(nums).toHaveLength(0);
  });

  it("extracts larger standalone numbers", () => {
    const claims = extractNumericClaims("The population is approximately 150,000 people.");
    expect(claims.length).toBeGreaterThanOrEqual(1);
    const numClaim = claims.find((c) => c.value === 150000);
    expect(numClaim).toBeDefined();
  });

  it("returns empty array for text without numbers", () => {
    const claims = extractNumericClaims("This is a simple sentence with no numbers.");
    expect(claims).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// extractDateClaims
// ---------------------------------------------------------------------------

describe("extractDateClaims", () => {
  it("extracts year mentions", () => {
    const claims = extractDateClaims("Founded in 2020 and expanded since 2023.");
    expect(claims).toHaveLength(2);
    expect(claims[0].value).toBe(2020);
    expect(claims[1].value).toBe(2023);
  });

  it("extracts month-year combinations", () => {
    const claims = extractDateClaims("Released in January 2024.");
    const monthYear = claims.find((c) => c.normalized === "January 2024");
    expect(monthYear).toBeDefined();
  });

  it("returns empty array for text without dates", () => {
    const claims = extractDateClaims("No dates mentioned here at all.");
    expect(claims).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// extractKeySentences
// ---------------------------------------------------------------------------

describe("extractKeySentences", () => {
  it("extracts up to 3 key sentences", () => {
    const text =
      "The unemployment rate is approximately 3.7%. " +
      "GDP growth was measured at 2.1% in 2023. " +
      "Inflation has been declining steadily. " +
      "The weather is nice today. " +
      "Federal Reserve policy shows a cautious approach.";
    const sentences = extractKeySentences(text);
    expect(sentences.length).toBeLessThanOrEqual(3);
    expect(sentences.length).toBeGreaterThan(0);
  });

  it("prioritizes factual sentences", () => {
    const text =
      "Many people enjoy walking through the park on sunny afternoons with friends. " +
      "The interest rate was reported at 5.25% according to the Federal Reserve. " +
      "Walking through nature can help reduce stress and improve mental health.";
    const sentences = extractKeySentences(text);
    // The factual sentence with % and "reported" should rank first
    const factualIndex = sentences.findIndex((s) => s.includes("interest rate"));
    expect(factualIndex).toBeGreaterThanOrEqual(0);
  });

  it("respects maxSentences parameter", () => {
    const text =
      "First sentence is here now. Second sentence is also here now. Third sentence is quite long as well.";
    const sentences = extractKeySentences(text, 1);
    expect(sentences).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// analyzeCitations
// ---------------------------------------------------------------------------

describe("analyzeCitations", () => {
  it("analyzes valid citations", () => {
    const result = analyzeCitations([
      { url: "https://example.com/article", title: "Article" },
      { url: "https://news.example.org/story", title: "Story" },
    ]);
    expect(result.totalCitations).toBe(2);
    expect(result.hasValidUrls).toBe(true);
    expect(result.domains).toContain("example.com");
    expect(result.domains).toContain("news.example.org");
  });

  it("filters out invalid URLs", () => {
    const result = analyzeCitations([
      { url: "javascript:alert(1)" },
      { url: "https://valid.com" },
    ]);
    expect(result.totalCitations).toBe(2);
    expect(result.hasValidUrls).toBe(true);
    expect(result.domains).toEqual(["valid.com"]);
  });

  it("handles empty citations", () => {
    const result = analyzeCitations([]);
    expect(result.totalCitations).toBe(0);
    expect(result.hasValidUrls).toBe(false);
    expect(result.domains).toHaveLength(0);
  });

  it("deduplicates domains", () => {
    const result = analyzeCitations([
      { url: "https://example.com/page1" },
      { url: "https://example.com/page2" },
    ]);
    expect(result.domains).toEqual(["example.com"]);
  });
});

// ---------------------------------------------------------------------------
// extractFactCheckData
// ---------------------------------------------------------------------------

describe("extractFactCheckData", () => {
  it("combines all extraction types", () => {
    const result = extractFactCheckData(
      "The rate was 5.25% in 2024. GDP is approximately $21 trillion according to reports.",
      [{ url: "https://example.com/data", title: "Source" }]
    );
    expect(result.claims.length).toBeGreaterThan(0);
    expect(result.citationAnalysis.totalCitations).toBe(1);
    expect(result.keySentences.length).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// compareAcrossModels
// ---------------------------------------------------------------------------

describe("compareAcrossModels", () => {
  it("detects numeric disagreement", () => {
    const models: ModelFactData[] = [
      {
        modelName: "model-a",
        factCheck: extractFactCheckData(
          "The interest rate is 5.25% according to the latest data.",
          []
        ),
      },
      {
        modelName: "model-b",
        factCheck: extractFactCheckData(
          "The interest rate is 4.75% based on recent reports.",
          []
        ),
      },
    ];
    const result = compareAcrossModels(models);
    expect(result.numericDisagreements.length).toBeGreaterThanOrEqual(1);
    expect(result.disagreementSignals.length).toBeGreaterThan(0);
  });

  it("reports agreement when numbers match", () => {
    const models: ModelFactData[] = [
      {
        modelName: "model-a",
        factCheck: extractFactCheckData(
          "The unemployment rate is 3.7% according to BLS.",
          [{ url: "https://bls.gov/data" }]
        ),
      },
      {
        modelName: "model-b",
        factCheck: extractFactCheckData(
          "Unemployment is at 3.7% per government data.",
          [{ url: "https://bls.gov/report" }]
        ),
      },
    ];
    const result = compareAcrossModels(models);
    expect(result.numericDisagreements).toHaveLength(0);
    expect(result.agreementSignals).toContain("consistent numeric claims");
  });

  it("detects citation overlap", () => {
    const models: ModelFactData[] = [
      {
        modelName: "model-a",
        factCheck: extractFactCheckData("Some text here.", [
          { url: "https://reuters.com/article1" },
        ]),
      },
      {
        modelName: "model-b",
        factCheck: extractFactCheckData("Other text here.", [
          { url: "https://reuters.com/article2" },
          { url: "https://bbc.com/news" },
        ]),
      },
    ];
    const result = compareAcrossModels(models);
    expect(result.sharedDomains).toContain("reuters.com");
    expect(result.citationOverlap).toBeGreaterThan(0);
  });

  it("flags when models are missing citations", () => {
    const models: ModelFactData[] = [
      {
        modelName: "model-a",
        factCheck: extractFactCheckData("Answer with source.", [
          { url: "https://example.com" },
        ]),
      },
      {
        modelName: "model-b",
        factCheck: extractFactCheckData("Answer without source.", []),
      },
    ];
    const result = compareAcrossModels(models);
    expect(result.modelsWithCitations).toBe(1);
    expect(result.disagreementSignals).toContain("1 model missing citations");
  });

  it("handles single model gracefully", () => {
    const models: ModelFactData[] = [
      {
        modelName: "model-a",
        factCheck: extractFactCheckData("Some answer text.", []),
      },
    ];
    const result = compareAcrossModels(models);
    expect(result.totalModels).toBe(1);
    expect(result.numericDisagreements).toHaveLength(0);
  });
});
