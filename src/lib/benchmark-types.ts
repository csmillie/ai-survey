// ---------------------------------------------------------------------------
// Benchmark Question Config Types (discriminated union)
// ---------------------------------------------------------------------------

export interface BenchmarkOption {
  label: string;
  value: string;
  numericValue?: number;
  isReversed?: boolean;
}

export interface SingleSelectConfig {
  type: "SINGLE_SELECT";
  options: BenchmarkOption[];
  allowDontKnow?: boolean;
}

export interface BinaryConfig {
  type: "BINARY";
  options: [BenchmarkOption, BenchmarkOption];
  reverseScored?: boolean;
}

export interface ForcedChoiceConfig {
  type: "FORCED_CHOICE";
  options: [BenchmarkOption, BenchmarkOption];
  poleALabel?: string;
  poleBLabel?: string;
}

export interface LikertConfig {
  type: "LIKERT";
  points: 4 | 5 | 7;
  options: BenchmarkOption[];
  reverseScored?: boolean;
}

export interface NumericScaleConfig {
  type: "NUMERIC_SCALE";
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface MatrixLikertConfig {
  type: "MATRIX_LIKERT";
  stem: string;
  options: BenchmarkOption[];
}

export type BenchmarkQuestionConfig =
  | SingleSelectConfig
  | BinaryConfig
  | ForcedChoiceConfig
  | LikertConfig
  | NumericScaleConfig
  | MatrixLikertConfig;

// ---------------------------------------------------------------------------
// Benchmark Response Types
// ---------------------------------------------------------------------------

export interface CategoricalResponse {
  selectedValue: string;
  confidence: number;
}

export interface NumericScaleResponse {
  score: number;
  confidence: number;
}

export type BenchmarkResponse = CategoricalResponse | NumericScaleResponse;

// ---------------------------------------------------------------------------
// All Question Types (including legacy)
// ---------------------------------------------------------------------------

export const ALL_QUESTION_TYPES = [
  "OPEN_ENDED",
  "RANKED",
  "SINGLE_SELECT",
  "BINARY",
  "FORCED_CHOICE",
  "LIKERT",
  "NUMERIC_SCALE",
  "MATRIX_LIKERT",
] as const;

export type QuestionTypeValue = (typeof ALL_QUESTION_TYPES)[number];

export const BENCHMARK_QUESTION_TYPES = [
  "SINGLE_SELECT",
  "BINARY",
  "FORCED_CHOICE",
  "LIKERT",
  "NUMERIC_SCALE",
  "MATRIX_LIKERT",
] as const;

export type BenchmarkQuestionType = (typeof BENCHMARK_QUESTION_TYPES)[number];

export function isBenchmarkType(type: string): type is BenchmarkQuestionType {
  return (BENCHMARK_QUESTION_TYPES as readonly string[]).includes(type);
}

/** Categorical benchmark types return { selectedValue, confidence } */
export const CATEGORICAL_TYPES = [
  "SINGLE_SELECT",
  "BINARY",
  "FORCED_CHOICE",
  "LIKERT",
  "MATRIX_LIKERT",
] as const;

export type CategoricalType = (typeof CATEGORICAL_TYPES)[number];

export function isCategoricalType(type: string): type is CategoricalType {
  return (CATEGORICAL_TYPES as readonly string[]).includes(type);
}
