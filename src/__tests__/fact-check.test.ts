import { describe, it, expect } from "vitest";
import {
  extractNumericClaims,
  extractDateClaims,
  extractRatingClaims,
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
  it("extracts percentages with category", () => {
    const claims = extractNumericClaims("The rate is 5.25% and another is 4.75 percent.");
    const pcts = claims.filter((c) => c.type === "percentage");
    expect(pcts).toHaveLength(2);
    expect(pcts[0].value).toBe(5.25);
    expect(pcts[0].category).toBe("percentage");
    expect(pcts[1].value).toBe(4.75);
    expect(pcts[1].category).toBe("percentage");
  });

  it("extracts currency values with category", () => {
    const claims = extractNumericClaims("Revenue was $1,234.56 and $2.5 billion.");
    const currencies = claims.filter((c) => c.category === "currency");
    expect(currencies.length).toBeGreaterThanOrEqual(1);
    expect(currencies.every((c) => c.raw.includes("$"))).toBe(true);
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
  it("extracts year mentions with category", () => {
    const claims = extractDateClaims("Founded in 2020 and expanded since 2023.");
    expect(claims).toHaveLength(2);
    expect(claims[0].value).toBe(2020);
    expect(claims[0].category).toBe("year");
    expect(claims[1].value).toBe(2023);
    expect(claims[1].category).toBe("year");
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

  it("reports agreement when numbers match with category-specific signal", () => {
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
    expect(result.agreementSignals).toContain("consistent percentage claims");
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

  it("detects percentage disagreement with category", () => {
    const models: ModelFactData[] = [
      {
        modelName: "model-a",
        factCheck: extractFactCheckData("Inflation is 3.2% this year.", []),
      },
      {
        modelName: "model-b",
        factCheck: extractFactCheckData("Inflation is 4.1% this year.", []),
      },
    ];
    const result = compareAcrossModels(models);
    expect(result.numericDisagreements.length).toBeGreaterThanOrEqual(1);
    const pctDisagreement = result.numericDisagreements.find(
      (d) => d.category === "percentage"
    );
    expect(pctDisagreement).toBeDefined();
    expect(result.disagreementSignals).toContain(
      "1 percentage disagreement detected"
    );
  });

  it("detects currency disagreement with category", () => {
    const models: ModelFactData[] = [
      {
        modelName: "model-a",
        factCheck: extractFactCheckData("Revenue was $2.5 billion last quarter.", []),
      },
      {
        modelName: "model-b",
        factCheck: extractFactCheckData("Revenue was $3.1 billion last quarter.", []),
      },
    ];
    const result = compareAcrossModels(models);
    expect(result.numericDisagreements.length).toBeGreaterThanOrEqual(1);
    const currDisagreement = result.numericDisagreements.find(
      (d) => d.category === "currency"
    );
    expect(currDisagreement).toBeDefined();
    expect(result.disagreementSignals).toContain(
      "1 dollar amount disagreement detected"
    );
  });

  it("detects year disagreement across models", () => {
    const models: ModelFactData[] = [
      {
        modelName: "model-a",
        factCheck: extractFactCheckData("The company was founded in 2015.", []),
      },
      {
        modelName: "model-b",
        factCheck: extractFactCheckData("The company was founded in 2017.", []),
      },
    ];
    const result = compareAcrossModels(models);
    expect(result.numericDisagreements.length).toBeGreaterThanOrEqual(1);
    const yearDisagreement = result.numericDisagreements.find(
      (d) => d.category === "year"
    );
    expect(yearDisagreement).toBeDefined();
    expect(result.disagreementSignals).toContain(
      "1 year disagreement detected"
    );
  });

  it("detects rating disagreement using normalized scores", () => {
    const models: ModelFactData[] = [
      {
        modelName: "model-a",
        factCheck: extractFactCheckData(
          "I would rate this product 8 out of 10 overall.",
          []
        ),
      },
      {
        modelName: "model-b",
        factCheck: extractFactCheckData(
          "I would rate this product 5 out of 10 overall.",
          []
        ),
      },
    ];
    const result = compareAcrossModels(models);
    expect(result.numericDisagreements.length).toBeGreaterThanOrEqual(1);
    const ratingDisagreement = result.numericDisagreements.find(
      (d) => d.category === "rating"
    );
    expect(ratingDisagreement).toBeDefined();
    expect(result.disagreementSignals).toContain(
      "1 rating disagreement detected"
    );
  });

  it("compares ratings across different scales via normalization", () => {
    const models: ModelFactData[] = [
      {
        modelName: "model-a",
        factCheck: extractFactCheckData(
          "I give this a score of 9 out of 10 for quality.",
          []
        ),
      },
      {
        modelName: "model-b",
        factCheck: extractFactCheckData(
          "I give this a score of 3 out of 5 for quality.",
          []
        ),
      },
    ];
    const result = compareAcrossModels(models);
    // 9/10 = 90% vs 3/5 = 60% → should disagree
    expect(result.numericDisagreements.length).toBeGreaterThanOrEqual(1);
    const ratingDisagreement = result.numericDisagreements.find(
      (d) => d.category === "rating"
    );
    expect(ratingDisagreement).toBeDefined();
  });

  it("reports rating agreement when scores align across scales", () => {
    const models: ModelFactData[] = [
      {
        modelName: "model-a",
        factCheck: extractFactCheckData(
          "Quality is rated 8 out of 10 by most reviewers.",
          []
        ),
      },
      {
        modelName: "model-b",
        factCheck: extractFactCheckData(
          "Quality is rated 4 out of 5 by most reviewers.",
          []
        ),
      },
    ];
    const result = compareAcrossModels(models);
    // 8/10 = 80% vs 4/5 = 80% → should agree
    expect(
      result.numericDisagreements.filter((d) => d.category === "rating")
    ).toHaveLength(0);
    expect(result.agreementSignals).toContain("consistent rating claims");
  });

  it("generates category-specific agreement signals for mixed claim types", () => {
    const models: ModelFactData[] = [
      {
        modelName: "model-a",
        factCheck: extractFactCheckData(
          "Growth is 5.2%. Revenue was $1.5 billion. Founded in 2020.",
          []
        ),
      },
      {
        modelName: "model-b",
        factCheck: extractFactCheckData(
          "Growth is 5.2%. Revenue was $1.5 billion. Founded in 2020.",
          []
        ),
      },
    ];
    const result = compareAcrossModels(models);
    expect(result.numericDisagreements).toHaveLength(0);
    expect(result.agreementSignals).toContain("consistent percentage claims");
    expect(result.agreementSignals).toContain("consistent dollar amount claims");
    expect(result.agreementSignals).toContain("consistent year claims");
  });
});

// ---------------------------------------------------------------------------
// extractRatingClaims
// ---------------------------------------------------------------------------

describe("extractRatingClaims", () => {
  it("extracts 'X out of Y' patterns", () => {
    const claims = extractRatingClaims("I rate this 7 out of 10 stars.");
    expect(claims).toHaveLength(1);
    expect(claims[0].type).toBe("rating");
    expect(claims[0].category).toBe("rating");
    expect(claims[0].value).toBe(7);
    expect(claims[0].scaleMax).toBe(10);
    expect(claims[0].normalizedScore).toBe(70);
  });

  it("extracts 'X/Y' slash patterns", () => {
    const claims = extractRatingClaims("Quality: 8/10, Value: 4.5/5");
    expect(claims).toHaveLength(2);
    expect(claims[0].normalized).toBe("8/10");
    expect(claims[0].normalizedScore).toBe(80);
    expect(claims[1].normalized).toBe("4.5/5");
    expect(claims[1].normalizedScore).toBe(90);
  });

  it("extracts ratings with context words", () => {
    const claims = extractRatingClaims(
      "Rated 85 out of 100 by critics. Score: 4/5."
    );
    expect(claims).toHaveLength(2);
    const outOf100 = claims.find((c) => c.scaleMax === 100);
    expect(outOf100).toBeDefined();
    expect(outOf100?.normalizedScore).toBe(85);
  });

  it("rejects ratings where value exceeds scale", () => {
    const claims = extractRatingClaims("Scored 12 out of 10.");
    expect(claims).toHaveLength(0);
  });

  it("rejects non-standard scales", () => {
    // Scale of 8 is not in the valid scales set
    const claims = extractRatingClaims("Rated 6 out of 8.");
    expect(claims).toHaveLength(0);
  });

  it("returns empty array for text without ratings", () => {
    const claims = extractRatingClaims("No ratings or scores mentioned.");
    expect(claims).toHaveLength(0);
  });

  it("handles decimal ratings", () => {
    const claims = extractRatingClaims("The movie received 3.5 out of 5 stars.");
    expect(claims).toHaveLength(1);
    expect(claims[0].value).toBe(3.5);
    expect(claims[0].scaleMax).toBe(5);
    expect(claims[0].normalizedScore).toBe(70);
  });
});
