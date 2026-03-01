import { describe, it, expect } from "vitest";
import {
  tokenize,
  cosineSimilarity,
  computeTfIdf,
  computeOpenEndedAgreement,
  computeRankedAgreement,
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
