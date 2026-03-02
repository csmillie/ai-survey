import { describe, it, expect } from "vitest";
import {
  extractSentences,
  normalizeText,
  findSharedEntities,
  findSharedKeyphrases,
  computeConsensusStrength,
  analyzeCommonalities,
  type ModelResponse,
  type Cluster,
} from "@/lib/analysis/commonalities";

// ---------------------------------------------------------------------------
// extractSentences
// ---------------------------------------------------------------------------

describe("extractSentences", () => {
  it("splits on sentence-ending punctuation", () => {
    const text =
      "The economy is growing steadily. Inflation remains under control! Will interest rates change?";
    const sentences = extractSentences(text);
    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toBe("The economy is growing steadily.");
    expect(sentences[1]).toBe("Inflation remains under control!");
    expect(sentences[2]).toBe("Will interest rates change?");
  });

  it("splits on newlines", () => {
    const text =
      "First point about the economy\nSecond point about inflation rates";
    const sentences = extractSentences(text);
    expect(sentences).toHaveLength(2);
  });

  it("filters out short fragments", () => {
    const text = "Yes. No. The economy is doing well overall.";
    const sentences = extractSentences(text);
    // "Yes." and "No." are < 20 chars
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toBe("The economy is doing well overall.");
  });

  it("returns empty array for empty text", () => {
    expect(extractSentences("")).toEqual([]);
  });

  it("trims whitespace from sentences", () => {
    const text =
      "  The economy is strong and growing.   Inflation is well controlled.  ";
    const sentences = extractSentences(text);
    expect(sentences[0]).toBe("The economy is strong and growing.");
  });
});

// ---------------------------------------------------------------------------
// normalizeText
// ---------------------------------------------------------------------------

describe("normalizeText", () => {
  it("lowercases and removes punctuation", () => {
    expect(normalizeText("Hello, World!")).toBe("hello world");
  });

  it("collapses whitespace", () => {
    expect(normalizeText("too   much   space")).toBe("too much space");
  });

  it("handles empty string", () => {
    expect(normalizeText("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// findSharedEntities
// ---------------------------------------------------------------------------

describe("findSharedEntities", () => {
  it("finds entities mentioned by multiple models", () => {
    const responses: ModelResponse[] = [
      {
        modelKey: "gpt-4",
        text: "",
        entities: {
          people: ["Elon Musk"],
          places: ["California"],
          organizations: ["Tesla"],
        },
      },
      {
        modelKey: "claude-3",
        text: "",
        entities: {
          people: ["Elon Musk"],
          places: ["Texas"],
          organizations: ["Tesla", "SpaceX"],
        },
      },
    ];

    const shared = findSharedEntities(responses);
    expect(shared.length).toBeGreaterThanOrEqual(2);

    const musk = shared.find(
      (e) => e.text.toLowerCase() === "elon musk"
    );
    expect(musk).toBeDefined();
    expect(musk?.type).toBe("PERSON");
    expect(musk?.count).toBe(2);

    const tesla = shared.find(
      (e) => e.text.toLowerCase() === "tesla"
    );
    expect(tesla).toBeDefined();
    expect(tesla?.type).toBe("ORG");
    expect(tesla?.count).toBe(2);
  });

  it("excludes entities in only one model", () => {
    const responses: ModelResponse[] = [
      {
        modelKey: "gpt-4",
        text: "",
        entities: {
          people: ["Alice"],
          places: [],
          organizations: [],
        },
      },
      {
        modelKey: "claude-3",
        text: "",
        entities: {
          people: ["Bob"],
          places: [],
          organizations: [],
        },
      },
    ];

    const shared = findSharedEntities(responses);
    expect(shared).toHaveLength(0);
  });

  it("matches entities case-insensitively", () => {
    const responses: ModelResponse[] = [
      {
        modelKey: "gpt-4",
        text: "",
        entities: {
          people: [],
          places: [],
          organizations: ["Google"],
        },
      },
      {
        modelKey: "claude-3",
        text: "",
        entities: {
          people: [],
          places: [],
          organizations: ["google"],
        },
      },
    ];

    const shared = findSharedEntities(responses);
    expect(shared).toHaveLength(1);
    expect(shared[0].count).toBe(2);
  });

  it("returns empty array when fewer than 2 models share entities", () => {
    const responses: ModelResponse[] = [
      {
        modelKey: "model-a",
        text: "",
        entities: { people: ["Alice"], places: [], organizations: [] },
      },
    ];
    const shared = findSharedEntities(responses);
    expect(shared).toHaveLength(0);
  });

  it("does not merge entities with the same name but different types", () => {
    // "Jordan" appears as a PERSON in model-a and as a PLACE in model-b.
    // They should be stored as separate entries, each with count 1, so
    // neither appears in the shared list (requires ≥2 models per entry).
    const responses: ModelResponse[] = [
      {
        modelKey: "model-a",
        text: "",
        entities: { people: ["Jordan"], places: [], organizations: [] },
      },
      {
        modelKey: "model-b",
        text: "",
        entities: { people: [], places: ["Jordan"], organizations: [] },
      },
    ];
    const shared = findSharedEntities(responses);
    // "Jordan" as PERSON is only in model-a; "Jordan" as PLACE only in model-b.
    // Neither should appear as shared.
    expect(shared.find((e) => e.text.toLowerCase() === "jordan")).toBeUndefined();
  });

  it("correctly shares an entity when the same name and type appears across models", () => {
    // Sanity-check alongside the collision test: same name + same type → shared.
    const responses: ModelResponse[] = [
      {
        modelKey: "model-a",
        text: "",
        entities: { people: ["Jordan"], places: [], organizations: [] },
      },
      {
        modelKey: "model-b",
        text: "",
        entities: { people: ["Jordan"], places: [], organizations: [] },
      },
    ];
    const shared = findSharedEntities(responses);
    const jordan = shared.find((e) => e.text.toLowerCase() === "jordan");
    expect(jordan).toBeDefined();
    expect(jordan?.type).toBe("PERSON");
    expect(jordan?.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// findSharedKeyphrases
// ---------------------------------------------------------------------------

describe("findSharedKeyphrases", () => {
  it("finds shared bigrams across models", () => {
    const responses: ModelResponse[] = [
      {
        modelKey: "gpt-4",
        text: "The central bank raised interest rates to combat inflation.",
      },
      {
        modelKey: "claude-3",
        text: "Interest rates were increased by the central bank to fight rising prices.",
      },
    ];

    const shared = findSharedKeyphrases(responses);
    // Both mention "interest rates" and "central bank"
    const interestRates = shared.find((kp) => kp.phrase === "interest rates");
    expect(interestRates).toBeDefined();
    expect(interestRates?.count).toBe(2);

    const centralBank = shared.find((kp) => kp.phrase === "central bank");
    expect(centralBank).toBeDefined();
    expect(centralBank?.count).toBe(2);
  });

  it("counts each model at most once per phrase", () => {
    const responses: ModelResponse[] = [
      {
        modelKey: "gpt-4",
        text: "Machine learning and machine learning techniques are advancing rapidly. Machine learning is powerful.",
      },
      {
        modelKey: "claude-3",
        text: "Machine learning is a key technology in the field of machine learning research.",
      },
    ];

    const shared = findSharedKeyphrases(responses);
    const ml = shared.find((kp) => kp.phrase === "machine learning");
    expect(ml).toBeDefined();
    // Each model counted once
    expect(ml?.count).toBe(2);
  });

  it("returns no shared phrases when texts have no overlapping bigrams or trigrams", () => {
    const responses: ModelResponse[] = [
      { modelKey: "gpt-4", text: "Apples and oranges are delicious fruits." },
      { modelKey: "claude-3", text: "Cats and dogs are popular pets worldwide." },
    ];

    const shared = findSharedKeyphrases(responses);
    // "and are" might share stop-word bigrams, but neither "apples and",
    // "and oranges", "cats and", "and dogs" etc. appear in both texts.
    // Neither "apples" nor "oranges" vocabulary overlaps with the pets text.
    const meaningfulPhrases = shared.filter(
      (kp) => !["and are", "are and"].includes(kp.phrase)
    );
    expect(meaningfulPhrases.find((kp) => kp.phrase.includes("apple"))).toBeUndefined();
    expect(meaningfulPhrases.find((kp) => kp.phrase.includes("cat"))).toBeUndefined();
    expect(meaningfulPhrases.find((kp) => kp.phrase.includes("dog"))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// computeConsensusStrength
// ---------------------------------------------------------------------------

describe("computeConsensusStrength", () => {
  it("returns LOW for no clusters", () => {
    expect(computeConsensusStrength([])).toBe("LOW");
  });

  it("returns HIGH when >=2 clusters with avg strength >= 0.75", () => {
    const clusters: Cluster[] = [
      {
        id: "c1",
        representative: "A",
        members: [
          { modelKey: "a", sentence: "A" },
          { modelKey: "b", sentence: "A" },
          { modelKey: "c", sentence: "A" },
        ],
        strength: 0.75,
      },
      {
        id: "c2",
        representative: "B",
        members: [
          { modelKey: "a", sentence: "B" },
          { modelKey: "b", sentence: "B" },
          { modelKey: "c", sentence: "B" },
        ],
        strength: 0.80,
      },
    ];
    expect(computeConsensusStrength(clusters)).toBe("HIGH");
  });

  it("returns MEDIUM when >=1 cluster with avg strength >= 0.5", () => {
    const clusters: Cluster[] = [
      {
        id: "c1",
        representative: "A",
        members: [
          { modelKey: "a", sentence: "A" },
          { modelKey: "b", sentence: "A" },
        ],
        strength: 0.6,
      },
    ];
    expect(computeConsensusStrength(clusters)).toBe("MEDIUM");
  });

  it("returns LOW when clusters exist but avg strength < 0.5", () => {
    const clusters: Cluster[] = [
      {
        id: "c1",
        representative: "A",
        members: [
          { modelKey: "a", sentence: "A" },
          { modelKey: "b", sentence: "A" },
        ],
        strength: 0.4,
      },
    ];
    expect(computeConsensusStrength(clusters)).toBe("LOW");
  });
});

// ---------------------------------------------------------------------------
// analyzeCommonalities — integration
// ---------------------------------------------------------------------------

describe("analyzeCommonalities", () => {
  it("returns empty result for fewer than 2 responses", () => {
    const result = analyzeCommonalities([
      { modelKey: "gpt-4", text: "The economy is doing well." },
    ]);
    expect(result.consensusStrength).toBe("LOW");
    expect(result.consensusPoints).toHaveLength(0);
    expect(result.sharedEntities).toHaveLength(0);
    expect(result.sharedKeyphrases).toHaveLength(0);
  });

  it("detects consensus from similar sentences across models", () => {
    const responses: ModelResponse[] = [
      {
        modelKey: "gpt-4",
        text: "Artificial intelligence is transforming the healthcare industry significantly. Many hospitals now use artificial intelligence for medical diagnosis. The technology reduces costs and improves patient outcomes.",
        entities: { people: [], places: [], organizations: [] },
      },
      {
        modelKey: "claude-3",
        text: "Artificial intelligence is transforming the healthcare industry rapidly. Many hospitals now use artificial intelligence for clinical diagnosis. The technology reduces costs and improves patient outcomes greatly.",
        entities: { people: [], places: [], organizations: [] },
      },
    ];

    const result = analyzeCommonalities(responses);
    // Sentences share most words so consensus points or keyphrases should be found
    expect(
      result.consensusPoints.length > 0 || result.sharedKeyphrases.length > 0
    ).toBe(true);
  });

  it("handles responses with no overlap gracefully", () => {
    const responses: ModelResponse[] = [
      {
        modelKey: "gpt-4",
        text: "Quantum computing uses qubits to perform complex calculations faster than classical computers.",
        entities: { people: [], places: [], organizations: [] },
      },
      {
        modelKey: "claude-3",
        text: "Renaissance art flourished in Italy during the fourteenth through seventeenth centuries.",
        entities: { people: [], places: [], organizations: [] },
      },
    ];

    const result = analyzeCommonalities(responses);
    expect(result.consensusStrength).toBe("LOW");
    expect(result.consensusPoints).toHaveLength(0);
  });

  it("works with 3 models and finds shared keyphrases", () => {
    const responses: ModelResponse[] = [
      {
        modelKey: "gpt-4",
        text: "Climate change poses severe risks to global food security and water resources.",
        entities: { people: [], places: [], organizations: [] },
      },
      {
        modelKey: "claude-3",
        text: "The impact of climate change on food security and water availability is a growing concern worldwide.",
        entities: { people: [], places: [], organizations: [] },
      },
      {
        modelKey: "gemini",
        text: "Global food security is threatened by climate change which affects water resources and agriculture.",
        entities: { people: [], places: [], organizations: [] },
      },
    ];

    const result = analyzeCommonalities(responses);
    // "climate change" and "food security" should appear
    const climateChange = result.sharedKeyphrases.find(
      (kp) => kp.phrase === "climate change"
    );
    expect(climateChange).toBeDefined();
    expect(climateChange?.count).toBeGreaterThanOrEqual(2);

    const foodSecurity = result.sharedKeyphrases.find(
      (kp) => kp.phrase === "food security"
    );
    expect(foodSecurity).toBeDefined();
    expect(foodSecurity?.count).toBeGreaterThanOrEqual(2);
  });

  it("returns at most 5 consensus clusters", () => {
    // Create responses with many similar sentences
    const baseSentences = [
      "Technology is advancing at an unprecedented pace today.",
      "Artificial intelligence is transforming many industries rapidly.",
      "Healthcare benefits greatly from modern technology innovations.",
      "Education systems are evolving with digital technology tools.",
      "Finance relies heavily on algorithmic trading systems now.",
      "Agriculture uses precision farming with modern technology methods.",
      "Transportation is being revolutionized by autonomous vehicles today.",
    ];

    const responses: ModelResponse[] = [
      {
        modelKey: "model-a",
        text: baseSentences.join(" "),
        entities: { people: [], places: [], organizations: [] },
      },
      {
        modelKey: "model-b",
        text: baseSentences.join(" "),
        entities: { people: [], places: [], organizations: [] },
      },
    ];

    const result = analyzeCommonalities(responses);
    expect(result.consensusPoints.length).toBeLessThanOrEqual(5);
  });

  it("uses pre-extracted entities when provided", () => {
    const responses: ModelResponse[] = [
      {
        modelKey: "gpt-4",
        text: "Something about technology.",
        entities: {
          people: ["Sam Altman"],
          places: ["San Francisco"],
          organizations: ["OpenAI"],
        },
      },
      {
        modelKey: "claude-3",
        text: "Something about artificial intelligence.",
        entities: {
          people: ["Sam Altman"],
          places: ["London"],
          organizations: ["OpenAI", "Anthropic"],
        },
      },
    ];

    const result = analyzeCommonalities(responses);
    const altman = result.sharedEntities.find(
      (e) => e.text.toLowerCase() === "sam altman"
    );
    expect(altman).toBeDefined();
    expect(altman?.type).toBe("PERSON");

    const openai = result.sharedEntities.find(
      (e) => e.text.toLowerCase() === "openai"
    );
    expect(openai).toBeDefined();
    expect(openai?.type).toBe("ORG");
  });
});
