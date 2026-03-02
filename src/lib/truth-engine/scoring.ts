// ---------------------------------------------------------------------------
// Truth Confidence Scoring — computes a 0–100 score with explainable breakdown
// ---------------------------------------------------------------------------

import type {
  ModelAnswer,
  TruthResult,
  TruthLabel,
  TruthBreakdown,
} from "./types";
import { extractClaims } from "./claim-extraction";
import {
  detectNumericDisagreements,
  clusterAssertions,
  hasStrongAssertionDisagreement,
} from "./disagreement";

/**
 * Compute the Truth Confidence score for a single question across all models.
 */
export function computeTruthScore(answers: ModelAnswer[]): TruthResult {
  if (answers.length === 0) {
    return {
      truthScore: 0,
      truthLabel: "LOW",
      consensusPercent: 0,
      citationRate: 0,
      numericDisagreements: [],
      claimClusters: [],
      breakdown: {
        baseScore: 50,
        consensusBonus: 0,
        citationBonus: 0,
        citationPenalty: 0,
        numericDisagreementPenalty: 0,
        assertionDisagreementPenalty: 0,
        emptyShortPenalty: 0,
        finalScore: 0,
      },
    };
  }

  // 1. Extract claims from all answers
  const allClaims = answers.flatMap((a) =>
    a.isEmpty ? [] : extractClaims(a.text, a.modelKey, a.citations)
  );

  // 2. Detect numeric disagreements
  const numericDisagreements = detectNumericDisagreements(allClaims);
  const numericDisagreementDetected = numericDisagreements.length > 0;

  // 3. Cluster by response text (Jaccard similarity across whole responses)
  const { clusters, consensusPercent } = clusterAssertions(answers);

  // 4. Compute citation rate
  const answersWithCitations = answers.filter(
    (a) => !a.isEmpty && a.citations.length > 0
  );
  const nonEmptyAnswers = answers.filter((a) => !a.isEmpty);
  const citationRate =
    nonEmptyAnswers.length > 0
      ? answersWithCitations.length / nonEmptyAnswers.length
      : 0;

  // 5. Check for empty/short answers
  const hasEmptyOrShort = answers.some((a) => a.isEmpty || a.isShort);

  // 6. Compute score
  let score = 50;

  // + 40 × consensusPercent
  const consensusBonus = 40 * consensusPercent;
  score += consensusBonus;

  // Citation bonuses
  let citationBonus = 0;
  if (citationRate >= 0.8) {
    citationBonus = 15; // 10 + 5
  } else if (citationRate >= 0.5) {
    citationBonus = 10;
  }
  score += citationBonus;

  // Citation penalty — only apply when consensus is low, to avoid penalising
  // factual questions where citations aren't expected but models still agree.
  let citationPenalty = 0;
  if (citationRate === 0 && consensusPercent < 0.6) {
    citationPenalty = -10;
    score -= 10;
  }

  // Numeric disagreement penalty
  let numericDisagreementPenalty = 0;
  if (numericDisagreementDetected) {
    numericDisagreementPenalty = -20;
    score -= 20;
  }

  // Assertion disagreement penalty
  let assertionDisagreementPenalty = 0;
  if (hasStrongAssertionDisagreement(clusters)) {
    assertionDisagreementPenalty = -10;
    score -= 10;
  }

  // Empty/short penalty
  let emptyShortPenalty = 0;
  if (hasEmptyOrShort) {
    emptyShortPenalty = -10;
    score -= 10;
  }

  // Clamp 0–100
  score = Math.max(0, Math.min(100, score));

  // Label
  let truthLabel: TruthLabel;
  if (score >= 80) {
    truthLabel = "HIGH";
  } else if (score >= 55) {
    truthLabel = "MEDIUM";
  } else {
    truthLabel = "LOW";
  }

  const breakdown: TruthBreakdown = {
    baseScore: 50,
    consensusBonus,
    citationBonus,
    citationPenalty,
    numericDisagreementPenalty,
    assertionDisagreementPenalty,
    emptyShortPenalty,
    finalScore: score,
  };

  return {
    truthScore: score,
    truthLabel,
    consensusPercent,
    citationRate,
    numericDisagreements,
    claimClusters: clusters,
    breakdown,
  };
}
