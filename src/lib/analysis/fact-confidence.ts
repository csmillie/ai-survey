// ---------------------------------------------------------------------------
// Fact Confidence Scoring — combines agreement, citation quality, and numeric
// consistency into a single confidence level per question.
// Pure computation, no IO.
// ---------------------------------------------------------------------------

import type { CrossModelComparison } from "./fact-check";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FactConfidenceLevel = "high" | "medium" | "low";

export interface FactConfidenceResult {
  level: FactConfidenceLevel;
  score: number; // 0-100
  signals: string[];
}

// ---------------------------------------------------------------------------
// Score weights
// ---------------------------------------------------------------------------

interface ScoreFactors {
  agreementPercent: number; // 0-1 from existing agreement engine
  comparison: CrossModelComparison;
  totalModels: number;
}

/**
 * Compute a fact confidence score for a single question based on cross-model
 * agreement, numeric consistency, and citation quality.
 *
 * Returns a level (high/medium/low), a numeric score (0-100), and human-readable
 * signals explaining the assessment.
 */
export function computeFactConfidence(
  factors: ScoreFactors
): FactConfidenceResult {
  let score = 50; // Start at neutral
  const signals: string[] = [];

  // --- Agreement contribution (strongest signal) ---
  // Full agreement (+30), strong agreement (+20), moderate (+10),
  // weak (-10), very weak (-20)
  if (factors.agreementPercent >= 0.95) {
    score += 30;
    signals.push("strong agreement");
  } else if (factors.agreementPercent >= 0.75) {
    score += 20;
    signals.push("moderate consensus");
  } else if (factors.agreementPercent >= 0.5) {
    score += 5;
    signals.push("partial agreement");
  } else {
    score -= 20;
    signals.push("low agreement across models");
  }

  // --- Numeric consistency (category-aware) ---
  const { numericDisagreements } = factors.comparison;
  if (numericDisagreements.length === 0) {
    // Check for any category-specific or general consistency signal
    const hasConsistentClaims = factors.comparison.agreementSignals.some(
      (s) => s.startsWith("consistent ") && s.endsWith(" claims")
    );
    if (hasConsistentClaims) {
      score += 10;
      // Signals already added by comparison
    }
  } else {
    score -= 10 * Math.min(numericDisagreements.length, 3);
    // Add category-specific disagreement signals
    const categories = new Set(
      numericDisagreements.map((d) => d.category).filter(Boolean)
    );
    if (categories.size > 0) {
      for (const cat of categories) {
        const label =
          cat === "percentage"
            ? "percentage"
            : cat === "currency"
              ? "dollar amount"
              : cat === "year"
                ? "year"
                : cat === "rating"
                  ? "rating"
                  : "numeric";
        signals.push(`${label} disagreement detected`);
      }
    } else {
      signals.push("numeric disagreement detected");
    }
  }

  // --- Citation quality ---
  const { modelsWithCitations, totalModels, citationOverlap, sharedDomains } =
    factors.comparison;

  if (totalModels > 1) {
    if (modelsWithCitations === totalModels) {
      score += 10;
      signals.push("multiple citations");
    } else if (modelsWithCitations === 0) {
      score -= 10;
      // Signal already added by comparison
    }
  }

  if (citationOverlap > 0.5) {
    score += 5;
    // overlapping sources signal already captured in comparison
  }

  if (sharedDomains.length > 0) {
    score += 5;
  }

  // --- Single-model penalty ---
  if (totalModels === 1) {
    score -= 15;
    signals.push("single model response");
  }

  // --- Consistent reasoning bonus ---
  if (factors.comparison.agreementSignals.includes("consistent reasoning")) {
    score += 5;
    signals.push("consistent reasoning");
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: FactConfidenceLevel;
  if (score >= 70) {
    level = "high";
  } else if (score >= 40) {
    level = "medium";
  } else {
    level = "low";
  }

  // Add comparison signals that aren't already in our list
  for (const signal of factors.comparison.agreementSignals) {
    if (!signals.includes(signal)) {
      signals.push(signal);
    }
  }
  for (const signal of factors.comparison.disagreementSignals) {
    if (!signals.includes(signal)) {
      signals.push(signal);
    }
  }

  return { level, score, signals };
}
