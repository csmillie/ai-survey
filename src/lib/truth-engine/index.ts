// ---------------------------------------------------------------------------
// Truth Engine — public API
// ---------------------------------------------------------------------------

export { extractClaims, extractNumericClaims, extractAssertionClaims } from "./claim-extraction";
export {
  detectNumericDisagreements,
  clusterAssertions,
  hasStrongAssertionDisagreement,
} from "./disagreement";
export { computeTruthScore } from "./scoring";
export type {
  ExtractedClaim,
  NumericDisagreement,
  ClaimCluster,
  TruthBreakdown,
  TruthLabel,
  TruthResult,
  ModelAnswer,
} from "./types";
