// src/app/app/surveys/[surveyId]/question-presets.ts
import type { BenchmarkOption } from "@/lib/benchmark-types";

// ---------------------------------------------------------------------------
// Shared config editor interface
// ---------------------------------------------------------------------------

export interface ConfigEditorProps {
  value: Record<string, unknown>;
  onChange: (config: Record<string, unknown>, valid: boolean) => void;
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

export function labelToSlug(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9\s_]/g, "").replace(/\s+/g, "_");
}

// ---------------------------------------------------------------------------
// Ranked presets
// ---------------------------------------------------------------------------

export const RANKED_PRESETS = [
  { key: "0-5" as const, label: "0–5", scalePreset: "0-5" as const, scaleMin: 0, scaleMax: 5 },
  { key: "0-10" as const, label: "0–10", scalePreset: "0-10" as const, scaleMin: 0, scaleMax: 10 },
  { key: "0-100" as const, label: "0–100", scalePreset: "0-100" as const, scaleMin: 0, scaleMax: 100 },
] as const;

// ---------------------------------------------------------------------------
// Binary presets
// ---------------------------------------------------------------------------

export interface BinaryPreset {
  key: string;
  label: string;
  options: [BenchmarkOption, BenchmarkOption];
}

export const BINARY_PRESETS: BinaryPreset[] = [
  {
    key: "yes-no",
    label: "Yes / No",
    options: [
      { label: "Yes", value: "yes", numericValue: 1 },
      { label: "No", value: "no", numericValue: 0 },
    ],
  },
  {
    key: "true-false",
    label: "True / False",
    options: [
      { label: "True", value: "true", numericValue: 1 },
      { label: "False", value: "false", numericValue: 0 },
    ],
  },
  {
    key: "agree-disagree",
    label: "Agree / Disagree",
    options: [
      { label: "Agree", value: "agree", numericValue: 1 },
      { label: "Disagree", value: "disagree", numericValue: 0 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Likert presets
// ---------------------------------------------------------------------------

export interface LikertPreset {
  key: string;
  label: string;
  options: BenchmarkOption[];
}

export const LIKERT_PRESETS: LikertPreset[] = [
  {
    key: "5-agree",
    label: "5-pt Agree/Disagree",
    options: [
      { label: "Strongly agree", value: "strongly_agree", numericValue: 5 },
      { label: "Agree", value: "agree", numericValue: 4 },
      { label: "Neither agree nor disagree", value: "neither", numericValue: 3 },
      { label: "Disagree", value: "disagree", numericValue: 2 },
      { label: "Strongly disagree", value: "strongly_disagree", numericValue: 1 },
    ],
  },
  {
    key: "7-agree",
    label: "7-pt Agree/Disagree",
    options: [
      { label: "Strongly agree", value: "strongly_agree", numericValue: 7 },
      { label: "Agree", value: "agree", numericValue: 6 },
      { label: "Somewhat agree", value: "somewhat_agree", numericValue: 5 },
      { label: "Neither agree nor disagree", value: "neither", numericValue: 4 },
      { label: "Somewhat disagree", value: "somewhat_disagree", numericValue: 3 },
      { label: "Disagree", value: "disagree", numericValue: 2 },
      { label: "Strongly disagree", value: "strongly_disagree", numericValue: 1 },
    ],
  },
  {
    key: "4-frequency",
    label: "4-pt Frequency",
    options: [
      { label: "Always", value: "always", numericValue: 4 },
      { label: "Often", value: "often", numericValue: 3 },
      { label: "Sometimes", value: "sometimes", numericValue: 2 },
      { label: "Never", value: "never", numericValue: 1 },
    ],
  },
  {
    key: "5-satisfaction",
    label: "5-pt Satisfaction",
    options: [
      { label: "Very satisfied", value: "very_satisfied", numericValue: 5 },
      { label: "Satisfied", value: "satisfied", numericValue: 4 },
      { label: "Neutral", value: "neutral", numericValue: 3 },
      { label: "Dissatisfied", value: "dissatisfied", numericValue: 2 },
      { label: "Very dissatisfied", value: "very_dissatisfied", numericValue: 1 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Matrix Likert column presets
// ---------------------------------------------------------------------------

export const MATRIX_LIKERT_PRESETS: LikertPreset[] = [
  {
    key: "3-amount",
    label: "3-pt Amount",
    options: [
      { label: "A great deal", value: "great_deal", numericValue: 3 },
      { label: "Only some", value: "only_some", numericValue: 2 },
      { label: "Hardly any", value: "hardly_any", numericValue: 1 },
    ],
  },
  {
    key: "5-agree",
    label: "5-pt Agree",
    options: LIKERT_PRESETS[0].options,
  },
];

// ---------------------------------------------------------------------------
// Default configs for each question type
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  OPEN_ENDED: {},
  RANKED: { scalePreset: "0-5", scaleMin: 0, scaleMax: 5, includeReasoning: true },
  SINGLE_SELECT: {
    type: "SINGLE_SELECT",
    options: [
      { label: "Option A", value: "option_a", numericValue: 2 },
      { label: "Option B", value: "option_b", numericValue: 1 },
    ],
  },
  BINARY: {
    type: "BINARY",
    options: BINARY_PRESETS[0].options,
  },
  FORCED_CHOICE: {
    type: "FORCED_CHOICE",
    options: [
      { label: "Position A", value: "a", numericValue: 1 },
      { label: "Position B", value: "b", numericValue: 0 },
    ],
  },
  LIKERT: {
    type: "LIKERT",
    points: 5,
    options: LIKERT_PRESETS[0].options,
  },
  NUMERIC_SCALE: {
    type: "NUMERIC_SCALE",
    min: 0,
    max: 10,
    minLabel: "",
    maxLabel: "",
  },
  MATRIX_LIKERT: {
    type: "MATRIX_LIKERT",
    stem: "Rate the following items:",
    options: MATRIX_LIKERT_PRESETS[0].options,
  },
};

// ---------------------------------------------------------------------------
// Question type metadata
// ---------------------------------------------------------------------------

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  OPEN_ENDED: "Open Ended",
  RANKED: "Ranked",
  SINGLE_SELECT: "Single Select",
  BINARY: "Binary",
  FORCED_CHOICE: "Forced Choice",
  LIKERT: "Likert",
  NUMERIC_SCALE: "Numeric Scale",
  MATRIX_LIKERT: "Matrix Likert",
};

export const QUESTION_TYPE_DESCRIPTIONS: Record<string, string> = {
  OPEN_ENDED: "Freeform text response",
  RANKED: "Numeric rating on a predefined scale",
  SINGLE_SELECT: "Pick one option from a list",
  BINARY: "True/false or yes/no choice",
  FORCED_CHOICE: "Choose between two opposing positions",
  LIKERT: "Agreement or frequency scale",
  NUMERIC_SCALE: "Continuous numeric range with labels",
  MATRIX_LIKERT: "Multiple rows on the same scale",
};

export const LEGACY_TYPES = ["OPEN_ENDED", "RANKED"] as const;
export const BENCHMARK_TYPES = ["SINGLE_SELECT", "BINARY", "FORCED_CHOICE", "LIKERT", "NUMERIC_SCALE", "MATRIX_LIKERT"] as const;

// ---------------------------------------------------------------------------
// QuestionData — moved from survey-builder.tsx for sharing with question-dialog.tsx
// ---------------------------------------------------------------------------

export interface MatrixRowData {
  id: string;
  rowKey: string;
  label: string;
  order: number;
}

export interface QuestionData {
  id: string;
  title: string;
  promptTemplate: string;
  mode: string;
  threadKey: string | null;
  order: number;
  type: string;
  configJson: Record<string, unknown> | null;
  matrixRows?: MatrixRowData[];
}
