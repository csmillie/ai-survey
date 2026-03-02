// ---------------------------------------------------------------------------
// Commonalities Engine — finds common points across 2–4 model responses
// using deterministic language analysis (TF-IDF, cosine similarity, n-grams).
// Pure computation, no LLM calls.
// ---------------------------------------------------------------------------

import {
  tokenize,
  computeTfIdf,
  cosineSimilarity,
  type TfIdfVector,
} from "@/lib/analysis/agreement";
import { extractEntities } from "@/lib/analysis/entities";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Cluster {
  id: string;
  representative: string;
  members: Array<{ modelKey: string; sentence: string }>;
  strength: number;
}

export interface SharedEntity {
  text: string;
  type: "PERSON" | "ORG" | "PLACE" | "OTHER";
  count: number;
  models: string[];
}

export interface SharedKeyphrase {
  phrase: string;
  count: number;
  models: string[];
}

export type ConsensusStrength = "HIGH" | "MEDIUM" | "LOW";

export interface CommonalitiesResult {
  consensusStrength: ConsensusStrength;
  consensusPoints: Cluster[];
  sharedEntities: SharedEntity[];
  sharedKeyphrases: SharedKeyphrase[];
}

export interface ModelResponse {
  modelKey: string;
  text: string;
  entities?: {
    people: string[];
    places: string[];
    organizations: string[];
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// 0.72 is empirically calibrated to catch paraphrase-level matches (same
// idea, different words) while avoiding over-clustering loosely related
// sentences. Values below ~0.65 tend to merge unrelated sentences; values
// above ~0.80 miss most paraphrases.
const SIMILARITY_THRESHOLD = 0.72;

// Filter out sentence fragments — 20 chars is roughly 3-4 words, below which
// there is not enough signal for TF-IDF similarity to be meaningful.
const MIN_SENTENCE_LENGTH = 20;

// Cap the output to the strongest 5 consensus points to keep the UI
// readable and the analysis focused on the most meaningful agreements.
const MAX_CLUSTERS = 5;

// Per-model sentence cap: clusterSentences is O(n²), so unbounded inputs from
// verbose responses would cause a combinatorial blowup. 40 sentences per model
// covers responses of ~2 000 words while keeping the worst case manageable
// (e.g. 4 models × 40 = 160 sentences → 12 800 similarity calls).
const MAX_SENTENCES_PER_MODEL = 40;

// Cap the keyphrase output in the engine layer so callers never silently
// discard results — the display limit and the analysis limit are explicit.
const MAX_KEYPHRASES = 15;

// ---------------------------------------------------------------------------
// Step 1 — Sentence Extraction
// ---------------------------------------------------------------------------

export function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_SENTENCE_LENGTH);
}

// ---------------------------------------------------------------------------
// Step 2 — Normalize Text
// ---------------------------------------------------------------------------

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Step 3 — Tokenize + TF-IDF (handled inline in analyzeCommonalities via
//           the imported tokenize() / computeTfIdf() utilities)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step 4 — Sentence Clustering
// ---------------------------------------------------------------------------

interface SentenceWithModel {
  modelKey: string;
  sentence: string;
  index: number;
}

/**
 * Determine how many unique models must appear in a cluster for it to
 * count as consensus.
 */
function getRequiredModelCount(totalModels: number): number {
  if (totalModels >= 4) return 3;
  return 2;
}

/**
 * Inline union-find for sentence clustering.
 */
function createUnionFind(n: number): {
  find: (x: number) => number;
  union: (x: number, y: number) => void;
} {
  const parent = Array.from({ length: n }, (_, i) => i);
  const rnk = new Array<number>(n).fill(0);

  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function union(x: number, y: number): void {
    const rx = find(x);
    const ry = find(y);
    if (rx === ry) return;
    if (rnk[rx] < rnk[ry]) {
      parent[rx] = ry;
    } else if (rnk[rx] > rnk[ry]) {
      parent[ry] = rx;
    } else {
      parent[ry] = rx;
      rnk[rx]++;
    }
  }

  return { find, union };
}

/**
 * Cluster sentences by cosine similarity of their TF-IDF vectors.
 * Only pairs from different models are compared.
 */
function clusterSentences(
  sentences: SentenceWithModel[],
  vectors: TfIdfVector[],
  totalModels: number
): Cluster[] {
  const n = sentences.length;
  const requiredModels = getRequiredModelCount(totalModels);
  const uf = createUnionFind(n);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (sentences[i].modelKey === sentences[j].modelKey) continue;
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      if (sim >= SIMILARITY_THRESHOLD) {
        uf.union(i, j);
      }
    }
  }

  // Collect clusters
  const clusterMap = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    const cluster = clusterMap.get(root);
    if (cluster) {
      cluster.push(i);
    } else {
      clusterMap.set(root, [i]);
    }
  }

  // Filter by model diversity and build Cluster objects
  const validClusters: Cluster[] = [];
  let clusterId = 0;

  for (const memberIndices of clusterMap.values()) {
    const uniqueModels = new Set(
      memberIndices.map((i) => sentences[i].modelKey)
    );
    if (uniqueModels.size < requiredModels) continue;

    // Representative = sentence with highest average cosine similarity to
    // other members in the cluster (most central).
    let bestIdx = memberIndices[0];
    let bestAvgSim = -1;

    for (const i of memberIndices) {
      let sumSim = 0;
      for (const j of memberIndices) {
        if (i === j) continue;
        sumSim += cosineSimilarity(vectors[i], vectors[j]);
      }
      const avgSim =
        memberIndices.length > 1 ? sumSim / (memberIndices.length - 1) : 0;
      if (avgSim > bestAvgSim) {
        bestAvgSim = avgSim;
        bestIdx = i;
      }
    }

    const strength = uniqueModels.size / totalModels;

    validClusters.push({
      id: `cluster-${clusterId}`,
      representative: sentences[bestIdx].sentence,
      members: memberIndices.map((i) => ({
        modelKey: sentences[i].modelKey,
        sentence: sentences[i].sentence,
      })),
      strength,
    });

    clusterId++;
  }

  // Sort by strength descending, then by member count
  validClusters.sort(
    (a, b) => b.strength - a.strength || b.members.length - a.members.length
  );

  return validClusters.slice(0, MAX_CLUSTERS);
}

// ---------------------------------------------------------------------------
// Step 5 — Shared Entities
// ---------------------------------------------------------------------------

export function findSharedEntities(
  responses: ModelResponse[]
): SharedEntity[] {
  const entityModelMap = new Map<
    string,
    { displayText: string; type: SharedEntity["type"]; models: Set<string> }
  >();

  for (const resp of responses) {
    const entities = resp.entities ?? extractEntities(resp.text);

    // Key includes the entity type so that the same word in different type
    // buckets (e.g. "Jordan" as PERSON in one model, PLACE in another) is
    // stored as two separate entries rather than silently merging into one.
    // displayText is first-seen-wins: whichever model's casing appears first
    // is preserved; subsequent models only add to the model set.
    for (const person of entities.people) {
      const text = person.trim();
      const key = `PERSON:${text.toLowerCase()}`;
      if (!key) continue;
      const existing = entityModelMap.get(key);
      if (existing) {
        existing.models.add(resp.modelKey);
      } else {
        entityModelMap.set(key, {
          displayText: text,
          type: "PERSON",
          models: new Set([resp.modelKey]),
        });
      }
    }

    for (const org of entities.organizations) {
      const text = org.trim();
      const key = `ORG:${text.toLowerCase()}`;
      if (!key) continue;
      const existing = entityModelMap.get(key);
      if (existing) {
        existing.models.add(resp.modelKey);
      } else {
        entityModelMap.set(key, {
          displayText: text,
          type: "ORG",
          models: new Set([resp.modelKey]),
        });
      }
    }

    for (const place of entities.places) {
      const text = place.trim();
      const key = `PLACE:${text.toLowerCase()}`;
      if (!key) continue;
      const existing = entityModelMap.get(key);
      if (existing) {
        existing.models.add(resp.modelKey);
      } else {
        entityModelMap.set(key, {
          displayText: text,
          type: "PLACE",
          models: new Set([resp.modelKey]),
        });
      }
    }
  }

  const shared: SharedEntity[] = [];
  for (const entry of entityModelMap.values()) {
    if (entry.models.size >= 2) {
      shared.push({
        text: entry.displayText,
        type: entry.type,
        count: entry.models.size,
        models: Array.from(entry.models),
      });
    }
  }

  return shared.sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Step 6 — Shared Keyphrases
// ---------------------------------------------------------------------------

function extractNgrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(" "));
  }
  return ngrams;
}

export function findSharedKeyphrases(
  responses: ModelResponse[]
): SharedKeyphrase[] {
  const phraseModelMap = new Map<string, Set<string>>();

  for (const resp of responses) {
    const tokens = tokenize(resp.text);
    const bigrams = extractNgrams(tokens, 2);
    const trigrams = extractNgrams(tokens, 3);
    // Deduplicate within each model (count max once per model)
    const allPhrases = new Set([...bigrams, ...trigrams]);

    for (const phrase of allPhrases) {
      const entry = phraseModelMap.get(phrase);
      if (entry) {
        entry.add(resp.modelKey);
      } else {
        phraseModelMap.set(phrase, new Set([resp.modelKey]));
      }
    }
  }

  const shared: SharedKeyphrase[] = [];
  for (const [phrase, models] of phraseModelMap) {
    if (models.size >= 2) {
      shared.push({
        phrase,
        count: models.size,
        models: Array.from(models),
      });
    }
  }

  return shared.sort((a, b) => b.count - a.count).slice(0, MAX_KEYPHRASES);
}

// ---------------------------------------------------------------------------
// Step 7 — Consensus Strength
// ---------------------------------------------------------------------------

export function computeConsensusStrength(
  clusters: Cluster[]
): ConsensusStrength {
  if (clusters.length === 0) return "LOW";

  const avgStrength =
    clusters.reduce((sum, c) => sum + c.strength, 0) / clusters.length;

  if (clusters.length >= 2 && avgStrength >= 0.75) return "HIGH";
  if (clusters.length >= 1 && avgStrength >= 0.5) return "MEDIUM";
  return "LOW";
}

// ---------------------------------------------------------------------------
// Main — analyzeCommonalities
// ---------------------------------------------------------------------------

/**
 * Run the full commonalities analysis pipeline on 2–4 model responses.
 *
 * Pipeline:
 *  1. Extract sentences (capped at MAX_SENTENCES_PER_MODEL per model)
 *  2–4. Tokenize → TF-IDF → cosine-similarity clustering → consensus points
 *  5. Find shared named entities across responses
 *  6. Find shared bigram/trigram keyphrases
 *  7. Derive overall consensus strength from cluster count + quality
 *
 * Returns an empty result (LOW strength, empty arrays) for fewer than 2
 * responses; never throws.
 */
export function analyzeCommonalities(
  responses: ModelResponse[]
): CommonalitiesResult {
  if (responses.length < 2) {
    return {
      consensusStrength: "LOW",
      consensusPoints: [],
      sharedEntities: [],
      sharedKeyphrases: [],
    };
  }

  const totalModels = responses.length;

  // Step 1: Extract sentences from all responses.
  // Cap per model to bound the O(n²) clustering cost.
  const sentences: SentenceWithModel[] = [];
  for (const resp of responses) {
    const extracted = extractSentences(resp.text).slice(0, MAX_SENTENCES_PER_MODEL);
    for (const sentence of extracted) {
      sentences.push({
        modelKey: resp.modelKey,
        sentence,
        index: sentences.length,
      });
    }
  }

  // Steps 2–4: Tokenize, TF-IDF, cluster
  let consensusPoints: Cluster[] = [];
  if (sentences.length >= 2) {
    const tokenized = sentences.map((s) => tokenize(s.sentence));
    const vectors = computeTfIdf(tokenized);
    consensusPoints = clusterSentences(sentences, vectors, totalModels);
  }

  // Steps 5–7
  const sharedEntities = findSharedEntities(responses);
  const sharedKeyphrases = findSharedKeyphrases(responses);
  const consensusStrength = computeConsensusStrength(consensusPoints);

  return {
    consensusStrength,
    consensusPoints,
    sharedEntities,
    sharedKeyphrases,
  };
}
