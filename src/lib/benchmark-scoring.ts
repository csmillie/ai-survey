import type {
  BenchmarkQuestionConfig,
  BenchmarkOption,
} from "@/lib/benchmark-types";
import { isCategoricalType } from "@/lib/benchmark-types";

function hasOptions(
  config: BenchmarkQuestionConfig,
): config is Extract<BenchmarkQuestionConfig, { options: BenchmarkOption[] }> {
  return "options" in config;
}

// ---------------------------------------------------------------------------
// Normalization — maps any benchmark answer to a 0–1 float
// ---------------------------------------------------------------------------

/**
 * Normalize a benchmark response to a 0-1 float.
 *
 * - Categorical types: uses the option's numericValue (or ordinal position)
 *   and maps it into [0, 1] based on the option range.
 * - NUMERIC_SCALE: linearly maps score from [min, max] to [0, 1].
 */
export function normalizeToZeroOne(
  questionType: string,
  value: string | number,
  config: BenchmarkQuestionConfig,
): number | null {
  if (questionType === "NUMERIC_SCALE" && config.type === "NUMERIC_SCALE") {
    const score = typeof value === "number" ? value : parseFloat(value);
    if (isNaN(score)) return null;
    const range = config.max - config.min;
    if (range === 0) return 0;
    return Math.max(0, Math.min(1, (score - config.min) / range));
  }

  if (isCategoricalType(questionType) && hasOptions(config)) {
    const selectedValue = String(value);
    const options = config.options;
    const selectedOption = options.find((o) => o.value === selectedValue);
    if (!selectedOption) return null;

    // Use numericValue if available, otherwise use ordinal position
    const numericValues = options.map((o, i) => o.numericValue ?? i);
    const selectedNumeric = selectedOption.numericValue ?? options.indexOf(selectedOption);

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    if (max === min) return 0;
    return (selectedNumeric - min) / (max - min);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Reverse scoring
// ---------------------------------------------------------------------------

/**
 * Flip a 0-1 normalized score. Used when a question is reverse-scored.
 */
export function applyReverseScoring(score: number, isReversed: boolean): number {
  return isReversed ? 1 - score : score;
}

// ---------------------------------------------------------------------------
// Construct Score Aggregation
// ---------------------------------------------------------------------------

/**
 * Reverse scoring contract: `isReversed` is a per-question flag, derived from
 * `BinaryConfig.reverseScored` or `LikertConfig.reverseScored`. The per-option
 * `BenchmarkOption.isReversed` field is not used here — it exists for UI display
 * and import/export metadata. Phase 2 callers should map from the question-level
 * flag, not the option-level one.
 */
export interface ConstructScoreInput {
  constructKey: string;
  normalizedScore: number;
  isReversed: boolean;
}

export interface ConstructScore {
  constructKey: string;
  mean: number;
  count: number;
}

/**
 * Groups responses by constructKey and computes the mean normalized score
 * per construct, applying reverse scoring where needed.
 */
export function computeConstructScores(
  responses: ConstructScoreInput[],
): ConstructScore[] {
  const groups = new Map<string, number[]>();

  for (const r of responses) {
    const adjusted = applyReverseScoring(r.normalizedScore, r.isReversed);
    const existing = groups.get(r.constructKey);
    if (existing) {
      existing.push(adjusted);
    } else {
      groups.set(r.constructKey, [adjusted]);
    }
  }

  const results: ConstructScore[] = [];
  for (const [constructKey, scores] of groups) {
    const sum = scores.reduce((a, b) => a + b, 0);
    results.push({
      constructKey,
      mean: sum / scores.length,
      count: scores.length,
    });
  }

  return results;
}
