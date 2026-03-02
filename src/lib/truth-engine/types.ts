// ---------------------------------------------------------------------------
// Truth Engine — shared types
// ---------------------------------------------------------------------------

export interface ExtractedClaim {
  kind: "numeric" | "assertion";
  text: string;
  normalized?: { value?: number; unit?: string; date?: string };
  citations?: string[];
  modelKey: string;
}

export interface NumericDisagreement {
  claimText: string;
  values: Array<{ modelKey: string; value: number; unit?: string }>;
  maxDelta: number;
}

export interface ClaimCluster {
  clusterId: number;
  kind: "numeric" | "assertion";
  claims: ExtractedClaim[];
  models: string[];
}

export interface TruthBreakdown {
  baseScore: number;
  consensusBonus: number;
  citationBonus: number;
  citationPenalty: number;
  numericDisagreementPenalty: number;
  assertionDisagreementPenalty: number;
  emptyShortPenalty: number;
  finalScore: number;
}

export type TruthLabel = "HIGH" | "MEDIUM" | "LOW";

export interface TruthResult {
  truthScore: number;
  truthLabel: TruthLabel;
  consensusPercent: number;
  citationRate: number;
  numericDisagreements: NumericDisagreement[];
  claimClusters: ClaimCluster[];
  breakdown: TruthBreakdown;
}

export interface ModelAnswer {
  modelKey: string;
  text: string;
  citations: string[];
  isEmpty: boolean;
  isShort: boolean;
}
