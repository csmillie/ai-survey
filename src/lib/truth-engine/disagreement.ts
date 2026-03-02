// ---------------------------------------------------------------------------
// Disagreement Detection — detects numeric and assertion-level disagreements
// ---------------------------------------------------------------------------

import type { ExtractedClaim, NumericDisagreement, ClaimCluster } from "./types";
import {
  tokenize,
  computeTfIdf,
  cosineSimilarity,
} from "@/lib/analysis/agreement";

// ---------------------------------------------------------------------------
// Numeric tolerance rules
// ---------------------------------------------------------------------------

interface NumericEntry {
  modelKey: string;
  value: number;
  unit?: string;
  claimText: string;
}

function numericTolerance(
  a: number,
  b: number,
  unit?: string
): boolean {
  if (unit === "%") {
    return Math.abs(a - b) <= 0.5;
  }
  if (unit === "$") {
    const relativeDelta = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
    return relativeDelta <= 0.05 || Math.abs(a - b) <= 500;
  }
  // Plain numbers: 5% relative tolerance
  const max = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / max <= 0.05;
}

/**
 * Detect numeric disagreements among claims from different models.
 */
export function detectNumericDisagreements(
  claims: ExtractedClaim[]
): NumericDisagreement[] {
  const numericClaims = claims.filter(
    (c): c is ExtractedClaim & { normalized: { value: number } } =>
      c.kind === "numeric" &&
      c.normalized !== undefined &&
      c.normalized.value !== undefined
  );

  if (numericClaims.length < 2) return [];

  // Group by unit to compare similar claims
  const byUnit = new Map<string, NumericEntry[]>();
  for (const claim of numericClaims) {
    const unit = claim.normalized.unit ?? "";
    const list = byUnit.get(unit);
    if (list) {
      list.push({
        modelKey: claim.modelKey,
        value: claim.normalized.value,
        unit: claim.normalized.unit,
        claimText: claim.text,
      });
    } else {
      byUnit.set(unit, [
        {
          modelKey: claim.modelKey,
          value: claim.normalized.value,
          unit: claim.normalized.unit,
          claimText: claim.text,
        },
      ]);
    }
  }

  const disagreements: NumericDisagreement[] = [];

  for (const [, entries] of byUnit) {
    // Need claims from at least 2 different models
    const models = new Set(entries.map((e) => e.modelKey));
    if (models.size < 2) continue;

    // Check all pairs for disagreement
    const disagreeingEntries: NumericEntry[] = [];
    let hasDisagreement = false;
    let maxDelta = 0;

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (entries[i].modelKey === entries[j].modelKey) continue;
        if (!numericTolerance(entries[i].value, entries[j].value, entries[i].unit)) {
          hasDisagreement = true;
          const delta = Math.abs(entries[i].value - entries[j].value);
          if (delta > maxDelta) maxDelta = delta;
          if (!disagreeingEntries.includes(entries[i])) {
            disagreeingEntries.push(entries[i]);
          }
          if (!disagreeingEntries.includes(entries[j])) {
            disagreeingEntries.push(entries[j]);
          }
        }
      }
    }

    if (hasDisagreement) {
      disagreements.push({
        claimText: disagreeingEntries[0].claimText,
        values: disagreeingEntries.map((e) => ({
          modelKey: e.modelKey,
          value: e.value,
          unit: e.unit,
        })),
        maxDelta,
      });
    }
  }

  return disagreements;
}

// ---------------------------------------------------------------------------
// Assertion clustering
// ---------------------------------------------------------------------------

const ASSERTION_SIMILARITY_THRESHOLD = 0.72;

/**
 * Cluster assertion claims by TF-IDF cosine similarity.
 * Returns clusters and the consensusPercent (largest cluster / total models).
 */
export function clusterAssertions(
  claims: ExtractedClaim[],
  totalModels: number
): { clusters: ClaimCluster[]; consensusPercent: number } {
  const assertions = claims.filter((c) => c.kind === "assertion");

  if (assertions.length === 0) {
    return { clusters: [], consensusPercent: totalModels > 0 ? 1 : 0 };
  }

  // Tokenize and compute TF-IDF
  const tokenized = assertions.map((c) => tokenize(c.text));
  const vectors = computeTfIdf(tokenized);

  // Union-Find for clustering
  const parent = Array.from({ length: assertions.length }, (_, i) => i);
  const rank = new Array(assertions.length).fill(0);

  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function union(x: number, y: number): void {
    const rx = find(x);
    const ry = find(y);
    if (rx === ry) return;
    if (rank[rx] < rank[ry]) {
      parent[rx] = ry;
    } else if (rank[rx] > rank[ry]) {
      parent[ry] = rx;
    } else {
      parent[ry] = rx;
      rank[rx]++;
    }
  }

  // Cluster by similarity
  for (let i = 0; i < assertions.length; i++) {
    for (let j = i + 1; j < assertions.length; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      if (sim >= ASSERTION_SIMILARITY_THRESHOLD) {
        union(i, j);
      }
    }
  }

  // Build clusters
  const clusterMap = new Map<number, number[]>();
  for (let i = 0; i < assertions.length; i++) {
    const root = find(i);
    const list = clusterMap.get(root);
    if (list) {
      list.push(i);
    } else {
      clusterMap.set(root, [i]);
    }
  }

  const clusters: ClaimCluster[] = [];
  let clusterId = 0;
  let largestClusterModelCount = 0;

  for (const members of clusterMap.values()) {
    const clusterClaims = members.map((i) => assertions[i]);
    const models = [...new Set(clusterClaims.map((c) => c.modelKey))];
    clusters.push({
      clusterId,
      kind: "assertion",
      claims: clusterClaims,
      models,
    });
    if (models.length > largestClusterModelCount) {
      largestClusterModelCount = models.length;
    }
    clusterId++;
  }

  const consensusPercent =
    totalModels > 0 ? largestClusterModelCount / totalModels : 0;

  return { clusters, consensusPercent };
}

/**
 * Detect if there's a strong assertion disagreement
 * (more than one cluster with >= 2 models each).
 */
export function hasStrongAssertionDisagreement(
  clusters: ClaimCluster[]
): boolean {
  const largeClusters = clusters.filter((c) => c.models.length >= 2);
  return largeClusters.length > 1;
}
