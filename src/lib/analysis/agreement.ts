// ---------------------------------------------------------------------------
// Agreement Engine — TF-IDF + cosine similarity for open-ended,
// stdev-based scoring for ranked questions. Pure computation, no IO.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgreementResult {
  agreementPercent: number;
  outlierModels: string[];
  humanReviewFlag: boolean;
  clusterDetails: ClusterDetail[] | null;
}

export interface ClusterDetail {
  clusterId: number;
  models: string[];
  size: number;
}

export interface OpenEndedResponse {
  modelName: string;
  text: string;
}

export interface RankedResponse {
  modelName: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Stopwords (minimal English set)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "and", "but", "or", "yet", "if", "because", "while", "although",
  "this", "that", "these", "those", "i", "me", "my", "myself", "we",
  "our", "ours", "ourselves", "you", "your", "yours", "yourself",
  "he", "him", "his", "himself", "she", "her", "hers", "herself",
  "it", "its", "itself", "they", "them", "their", "theirs", "themselves",
  "what", "which", "who", "whom", "whose",
]);

// ---------------------------------------------------------------------------
// Tokenization
// ---------------------------------------------------------------------------

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// ---------------------------------------------------------------------------
// TF-IDF computation
// ---------------------------------------------------------------------------

export interface TfIdfVector {
  [term: string]: number;
}

export function computeTfIdf(documents: string[][]): TfIdfVector[] {
  const n = documents.length;
  if (n === 0) return [];

  // Document frequency: how many documents contain each term
  const df = new Map<string, number>();
  for (const doc of documents) {
    const seen = new Set<string>();
    for (const term of doc) {
      if (!seen.has(term)) {
        df.set(term, (df.get(term) ?? 0) + 1);
        seen.add(term);
      }
    }
  }

  // TF-IDF per document
  return documents.map((doc) => {
    const termCounts = new Map<string, number>();
    for (const term of doc) {
      termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
    }

    const vec: TfIdfVector = {};
    for (const [term, count] of termCounts) {
      const tf = count / doc.length;
      const idf = Math.log(n / (df.get(term) ?? 1));
      vec[term] = tf * idf;
    }
    return vec;
  });
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

export function cosineSimilarity(a: TfIdfVector, b: TfIdfVector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  const allTerms = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const term of allTerms) {
    const va = a[term] ?? 0;
    const vb = b[term] ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Union-Find for clustering
// ---------------------------------------------------------------------------

class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  union(x: number, y: number): void {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return;

    if (this.rank[rx] < this.rank[ry]) {
      this.parent[rx] = ry;
    } else if (this.rank[rx] > this.rank[ry]) {
      this.parent[ry] = rx;
    } else {
      this.parent[ry] = rx;
      this.rank[rx]++;
    }
  }

  getClusters(n: number): Map<number, number[]> {
    const clusters = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const root = this.find(i);
      const cluster = clusters.get(root);
      if (cluster) {
        cluster.push(i);
      } else {
        clusters.set(root, [i]);
      }
    }
    return clusters;
  }
}

// ---------------------------------------------------------------------------
// Open-ended agreement
// ---------------------------------------------------------------------------

export function computeOpenEndedAgreement(
  responses: OpenEndedResponse[],
  threshold = 0.5
): AgreementResult {
  if (responses.length === 0) {
    return {
      agreementPercent: 0,
      outlierModels: [],
      humanReviewFlag: true,
      clusterDetails: null,
    };
  }

  if (responses.length === 1) {
    return {
      agreementPercent: 1,
      outlierModels: [],
      humanReviewFlag: false,
      clusterDetails: [
        { clusterId: 0, models: [responses[0].modelName], size: 1 },
      ],
    };
  }

  const tokenized = responses.map((r) => tokenize(r.text));
  const vectors = computeTfIdf(tokenized);

  // Cluster using union-find
  const uf = new UnionFind(responses.length);

  // Pre-cluster identical tokenized texts (TF-IDF produces zero vectors for
  // terms that appear in every document, so identical docs won't cluster)
  const tokenKeys = tokenized.map((t) => t.join(" "));
  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      if (tokenKeys[i] === tokenKeys[j]) {
        uf.union(i, j);
        continue;
      }
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      if (sim >= threshold) {
        uf.union(i, j);
      }
    }
  }

  const clusterMap = uf.getClusters(responses.length);

  // Find largest cluster
  let largestSize = 0;
  for (const members of clusterMap.values()) {
    if (members.length > largestSize) {
      largestSize = members.length;
    }
  }

  const agreementPercent = largestSize / responses.length;

  // Outliers = models not in the largest cluster
  const outlierModels: string[] = [];
  const clusterDetails: ClusterDetail[] = [];
  let clusterId = 0;

  for (const members of clusterMap.values()) {
    const models = members.map((i) => responses[i].modelName);
    clusterDetails.push({ clusterId, models, size: members.length });

    if (members.length < largestSize) {
      outlierModels.push(...models);
    }
    clusterId++;
  }

  return {
    agreementPercent,
    outlierModels,
    humanReviewFlag: agreementPercent < 0.67,
    clusterDetails,
  };
}

// ---------------------------------------------------------------------------
// Ranked agreement
// ---------------------------------------------------------------------------

export function computeRankedAgreement(
  responses: RankedResponse[],
  scaleMin: number,
  scaleMax: number
): AgreementResult {
  if (responses.length === 0) {
    return {
      agreementPercent: 0,
      outlierModels: [],
      humanReviewFlag: true,
      clusterDetails: null,
    };
  }

  if (responses.length === 1) {
    return {
      agreementPercent: 1,
      outlierModels: [],
      humanReviewFlag: false,
      clusterDetails: null,
    };
  }

  const scores = responses.map((r) => r.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const stdev = Math.sqrt(variance);
  const range = scaleMax - scaleMin;

  let agreementPercent: number;
  if (range === 0) {
    agreementPercent = 1;
  } else {
    const stdevRatio = stdev / range;
    if (stdevRatio <= 0.05) {
      agreementPercent = 1.0;
    } else if (stdevRatio <= 0.15) {
      agreementPercent = 0.75;
    } else {
      agreementPercent = 0.5;
    }
  }

  // Outliers: models > 1.5 stdev from mean
  const outlierModels = responses
    .filter((r) => Math.abs(r.score - mean) > 1.5 * stdev)
    .map((r) => r.modelName);

  return {
    agreementPercent,
    outlierModels,
    humanReviewFlag: agreementPercent < 0.67,
    clusterDetails: null,
  };
}
