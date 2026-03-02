import { describe, it, expect } from "vitest";
import {
  tokenize,
  cosineSimilarity,
  computeTfIdf,
  computeOpenEndedAgreement,
  computeRankedAgreement,
  extractPredictionDirection,
} from "@/lib/analysis/agreement";

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

describe("tokenize", () => {
  it("lowercases and strips punctuation", () => {
    const tokens = tokenize("Hello, World! This is great.");
    expect(tokens).toContain("hello");
    expect(tokens).toContain("world");
    expect(tokens).toContain("great");
    // Stopwords removed
    expect(tokens).not.toContain("this");
    expect(tokens).not.toContain("is");
  });

  it("removes single-character tokens", () => {
    const tokens = tokenize("I a b test");
    expect(tokens).toContain("test");
    expect(tokens).not.toContain("b");
  });
});

// ---------------------------------------------------------------------------
// TF-IDF + cosine similarity
// ---------------------------------------------------------------------------

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const vec = { apple: 1, banana: 2 };
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = { apple: 1 };
    const b = { banana: 1 };
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity({}, {})).toBe(0);
  });
});

describe("computeTfIdf", () => {
  it("returns empty for no documents", () => {
    expect(computeTfIdf([])).toEqual([]);
  });

  it("computes non-zero TF-IDF for differing documents", () => {
    const docs = [
      ["apple", "banana", "cherry"],
      ["apple", "date", "elderberry"],
    ];
    const vectors = computeTfIdf(docs);
    expect(vectors).toHaveLength(2);
    // "apple" appears in both docs so IDF = log(2/2) = 0
    expect(vectors[0]["apple"]).toBe(0);
    // "banana" appears in 1 doc so IDF = log(2/1) > 0
    expect(vectors[0]["banana"]).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// extractPredictionDirection
// ---------------------------------------------------------------------------

describe("extractPredictionDirection", () => {
  it("detects 'Yes' at the start as positive", () => {
    expect(
      extractPredictionDirection("Yes, the Bank of Canada will cut rates.")
    ).toBe("positive");
  });

  it("detects 'No' at the start as negative", () => {
    expect(
      extractPredictionDirection("No, the Bank of Canada will not cut rates.")
    ).toBe("negative");
  });

  it("detects 'unlikely' in first sentence as negative", () => {
    expect(
      extractPredictionDirection(
        "It is unlikely that the central bank will ease policy."
      )
    ).toBe("negative");
  });

  it("detects 'not likely' as negative", () => {
    expect(
      extractPredictionDirection(
        "A rate cut is not likely given current inflation."
      )
    ).toBe("negative");
  });

  it("detects 'probably not' as negative", () => {
    expect(
      extractPredictionDirection("Probably not. Inflation remains sticky.")
    ).toBe("negative");
  });

  it("detects 'uncertain' as uncertain", () => {
    expect(
      extractPredictionDirection(
        "It is uncertain whether the Bank of Canada will act."
      )
    ).toBe("uncertain");
  });

  it("detects 'hard to predict' as uncertain", () => {
    expect(
      extractPredictionDirection(
        "It is hard to predict what the central bank will do."
      )
    ).toBe("uncertain");
  });

  it("detects 'too early to say' as uncertain", () => {
    expect(
      extractPredictionDirection("It is too early to say definitively.")
    ).toBe("uncertain");
  });

  it("detects 'remains to be seen' as uncertain", () => {
    expect(
      extractPredictionDirection("It remains to be seen whether rates move.")
    ).toBe("uncertain");
  });

  it("detects 'likely' in first sentence as positive", () => {
    expect(
      extractPredictionDirection(
        "The Bank of Canada will likely cut interest rates."
      )
    ).toBe("positive");
  });

  it("detects 'probably' as positive", () => {
    expect(
      extractPredictionDirection(
        "The central bank will probably reduce rates."
      )
    ).toBe("positive");
  });

  it("returns null for factual answers without prediction signals", () => {
    expect(
      extractPredictionDirection(
        "The capital of France is Paris, a city known for its culture."
      )
    ).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(extractPredictionDirection("")).toBeNull();
  });

  it("only examines the first sentence", () => {
    // "likely" appears in the second sentence, not the first
    expect(
      extractPredictionDirection(
        "The economic outlook is mixed. A rate cut is likely."
      )
    ).toBeNull();
  });

  it("handles 'won't' as negative", () => {
    expect(
      extractPredictionDirection("The Bank of Canada won't cut rates soon.")
    ).toBe("negative");
  });

  it("handles 'could go either way' as uncertain", () => {
    expect(
      extractPredictionDirection("This one could go either way.")
    ).toBe("uncertain");
  });
});

// ---------------------------------------------------------------------------
// computeOpenEndedAgreement
// ---------------------------------------------------------------------------

describe("computeOpenEndedAgreement", () => {
  it("returns 100% agreement for identical answers", () => {
    const responses = [
      { modelName: "gpt-4", text: "The capital of France is Paris" },
      { modelName: "claude-3", text: "The capital of France is Paris" },
      { modelName: "gemini", text: "The capital of France is Paris" },
    ];
    const result = computeOpenEndedAgreement(responses);
    expect(result.agreementPercent).toBe(1);
    expect(result.outlierModels).toEqual([]);
    expect(result.humanReviewFlag).toBe(false);
  });

  it("detects divergent answers", () => {
    const responses = [
      { modelName: "gpt-4", text: "The capital of France is Paris, a beautiful city in Europe" },
      { modelName: "claude-3", text: "Quantum computing uses qubits for parallel processing power" },
      { modelName: "gemini", text: "Football is the most popular sport in the world today" },
    ];
    const result = computeOpenEndedAgreement(responses);
    // All completely different topics — each in own cluster
    expect(result.agreementPercent).toBeLessThan(0.67);
    expect(result.humanReviewFlag).toBe(true);
  });

  it("identifies partial agreement with outlier", () => {
    const responses = [
      { modelName: "gpt-4", text: "Python programming language data science machine learning analysis statistics" },
      { modelName: "claude-3", text: "Python programming language data science machine learning analysis models" },
      { modelName: "gemini", text: "Football soccer basketball sports athletic competition tournament league" },
    ];
    // Lower threshold to ensure clustering of very similar documents
    const result = computeOpenEndedAgreement(responses, 0.4);
    // gpt-4 and claude-3 should cluster, gemini is outlier
    expect(result.outlierModels).toContain("gemini");
    expect(result.agreementPercent).toBeCloseTo(2 / 3, 1);
  });

  it("handles single model", () => {
    const result = computeOpenEndedAgreement([
      { modelName: "gpt-4", text: "Hello world" },
    ]);
    expect(result.agreementPercent).toBe(1);
    expect(result.humanReviewFlag).toBe(false);
  });

  it("handles empty input", () => {
    const result = computeOpenEndedAgreement([]);
    expect(result.agreementPercent).toBe(0);
    expect(result.humanReviewFlag).toBe(true);
  });

  it("clusters prediction-style responses by direction despite different explanations", () => {
    const responses = [
      {
        modelName: "gemini",
        text: "Yes, the Bank of Canada will likely cut interest rates. Economic indicators show declining inflation and GDP growth has slowed significantly this quarter.",
      },
      {
        modelName: "openai",
        text: "It is uncertain whether the Bank of Canada will adjust rates. While some data points toward easing, other factors complicate the outlook.",
      },
      {
        modelName: "grok",
        text: "Yes, there is a strong likelihood that the Bank of Canada will reduce its policy rate. The labor market has softened and commodity prices have fallen.",
      },
      {
        modelName: "claude",
        text: "The outlook for Bank of Canada rate cuts is uncertain, and may lean toward no change. The central bank faces a complex environment.",
      },
    ];
    const result = computeOpenEndedAgreement(responses);
    // Gemini + Grok both say "Yes" → cluster of 2
    // OpenAI + Claude both say "uncertain" → cluster of 2
    // Largest cluster = 2 → agreement = 50%
    expect(result.agreementPercent).toBe(0.5);
    expect(result.humanReviewFlag).toBe(true);
  });

  it("does not use prediction clustering for factual answers without signals", () => {
    const responses = [
      {
        modelName: "gpt-4",
        text: "The capital of France is Paris, a beautiful city in Europe.",
      },
      {
        modelName: "claude-3",
        text: "Quantum computing uses qubits for parallel processing power.",
      },
      {
        modelName: "gemini",
        text: "Football is the most popular sport in the world today.",
      },
    ];
    const result = computeOpenEndedAgreement(responses);
    // No prediction signals → falls through to TF-IDF → all different topics
    expect(result.agreementPercent).toBeLessThan(0.67);
  });
});

// ---------------------------------------------------------------------------
// computeRankedAgreement
// ---------------------------------------------------------------------------

describe("computeRankedAgreement", () => {
  it("returns 100% agreement for identical scores", () => {
    const responses = [
      { modelName: "gpt-4", score: 7 },
      { modelName: "claude-3", score: 7 },
      { modelName: "gemini", score: 7 },
    ];
    const result = computeRankedAgreement(responses, 0, 10);
    expect(result.agreementPercent).toBe(1.0);
    expect(result.outlierModels).toEqual([]);
    expect(result.humanReviewFlag).toBe(false);
  });

  it("returns 0.75 for moderate variance", () => {
    // stdev needs to be between 5% and 15% of range (10)
    // scores [6, 7, 8] → mean=7, stdev=0.816, stdev/range=0.082
    const responses = [
      { modelName: "gpt-4", score: 6 },
      { modelName: "claude-3", score: 7 },
      { modelName: "gemini", score: 8 },
    ];
    const result = computeRankedAgreement(responses, 0, 10);
    expect(result.agreementPercent).toBe(0.75);
    expect(result.humanReviewFlag).toBe(false);
  });

  it("returns 0.5 for high variance", () => {
    const responses = [
      { modelName: "gpt-4", score: 2 },
      { modelName: "claude-3", score: 8 },
      { modelName: "gemini", score: 5 },
    ];
    const result = computeRankedAgreement(responses, 0, 10);
    expect(result.agreementPercent).toBe(0.5);
    expect(result.humanReviewFlag).toBe(true);
  });

  it("identifies outliers beyond 1.5 stdev", () => {
    const responses = [
      { modelName: "gpt-4", score: 7 },
      { modelName: "claude-3", score: 7 },
      { modelName: "gemini", score: 7 },
      { modelName: "perplexity", score: 2 },
    ];
    const result = computeRankedAgreement(responses, 0, 10);
    expect(result.outlierModels).toContain("perplexity");
    expect(result.outlierModels).not.toContain("gpt-4");
  });

  it("handles single model", () => {
    const result = computeRankedAgreement(
      [{ modelName: "gpt-4", score: 5 }],
      0,
      10
    );
    expect(result.agreementPercent).toBe(1);
    expect(result.humanReviewFlag).toBe(false);
  });

  it("handles empty input", () => {
    const result = computeRankedAgreement([], 0, 10);
    expect(result.agreementPercent).toBe(0);
    expect(result.humanReviewFlag).toBe(true);
  });
});
