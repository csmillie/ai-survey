import { z } from "zod";
import { ALL_QUESTION_TYPES, BENCHMARK_QUESTION_TYPES } from "@/lib/benchmark-types";

// ---------------------------------------------------------------------------
// LLM Response
// ---------------------------------------------------------------------------

export const citationSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  snippet: z.string().optional(),
});

export const llmResponseSchema = z.object({
  answerText: z.string(),
  citations: z.array(citationSchema),
  confidence: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  score: z.number().optional(),
  reasoning: z.string().optional(),
});

export type LlmResponsePayload = z.infer<typeof llmResponseSchema>;
export type Citation = z.infer<typeof citationSchema>;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const updateProfileSchema = z.object({
  name: z.string().max(100).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const disableAccountSchema = z.object({
  confirmPassword: z.string().min(1),
});

export type DisableAccountInput = z.infer<typeof disableAccountSchema>;

// ---------------------------------------------------------------------------
// Survey
// ---------------------------------------------------------------------------

export const createSurveySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
});

export type CreateSurveyInput = z.infer<typeof createSurveySchema>;

export const updateSurveySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
});

export type UpdateSurveyInput = z.infer<typeof updateSurveySchema>;

// ---------------------------------------------------------------------------
// Ranked Question Config
// ---------------------------------------------------------------------------

export const SCALE_PRESETS = {
  "0-5": { min: 0, max: 5 },
  "0-10": { min: 0, max: 10 },
  "0-100": { min: 0, max: 100 },
} as const;

export type ScalePreset = keyof typeof SCALE_PRESETS;

export const rankedConfigSchema = z.object({
  scalePreset: z.enum(["0-5", "0-10", "0-100"]),
  scaleMin: z.number().int().min(0),
  scaleMax: z.number().int().min(1).max(1000),
  includeReasoning: z.boolean(),
}).refine((data) => data.scaleMin < data.scaleMax, {
  message: "scaleMin must be less than scaleMax",
  path: ["scaleMin"],
});

export type RankedConfig = z.infer<typeof rankedConfigSchema>;

export const rankedResponseSchema = z.object({
  score: z.number(),
  reasoning: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
});

export type RankedResponsePayload = z.infer<typeof rankedResponseSchema>;

// ---------------------------------------------------------------------------
// Benchmark Question Config Schemas
// ---------------------------------------------------------------------------

export const benchmarkOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  numericValue: z.number().optional(),
  isReversed: z.boolean().optional(),
});

export type BenchmarkOptionInput = z.infer<typeof benchmarkOptionSchema>;

export const singleSelectConfigSchema = z.object({
  type: z.literal("SINGLE_SELECT"),
  options: z.array(benchmarkOptionSchema).min(2),
  allowDontKnow: z.boolean().optional(),
});

export const binaryConfigSchema = z.object({
  type: z.literal("BINARY"),
  options: z.tuple([benchmarkOptionSchema, benchmarkOptionSchema]),
  reverseScored: z.boolean().optional(),
});

export const forcedChoiceConfigSchema = z.object({
  type: z.literal("FORCED_CHOICE"),
  options: z.tuple([benchmarkOptionSchema, benchmarkOptionSchema]),
  poleALabel: z.string().optional(),
  poleBLabel: z.string().optional(),
});

export const likertConfigSchema = z.object({
  type: z.literal("LIKERT"),
  points: z.union([z.literal(4), z.literal(5), z.literal(7)]),
  options: z.array(benchmarkOptionSchema).min(4).max(7),
  reverseScored: z.boolean().optional(),
}).refine(
  (data) => data.options.length === data.points,
  { message: "Number of options must match points", path: ["options"] },
);

export const numericScaleConfigSchema = z.object({
  type: z.literal("NUMERIC_SCALE"),
  min: z.number().int(),
  max: z.number().int(),
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
}).refine(
  (data) => data.min < data.max,
  { message: "min must be less than max", path: ["min"] },
);

export const matrixLikertConfigSchema = z.object({
  type: z.literal("MATRIX_LIKERT"),
  stem: z.string().min(1),
  options: z.array(benchmarkOptionSchema).min(2),
});

export const benchmarkQuestionConfigSchema = z.discriminatedUnion("type", [
  singleSelectConfigSchema,
  binaryConfigSchema,
  forcedChoiceConfigSchema,
  likertConfigSchema,
  numericScaleConfigSchema,
  matrixLikertConfigSchema,
]);

export type BenchmarkQuestionConfigInput = z.infer<typeof benchmarkQuestionConfigSchema>;

// ---------------------------------------------------------------------------
// Benchmark Response Schemas
// ---------------------------------------------------------------------------

export const categoricalResponseSchema = z.object({
  selectedValue: z.string(),
  confidence: z.number().min(0).max(100),
});

export type CategoricalResponseInput = z.infer<typeof categoricalResponseSchema>;

export const numericScaleResponseSchema = z.object({
  score: z.number(),
  confidence: z.number().min(0).max(100),
});

export type NumericScaleResponseInput = z.infer<typeof numericScaleResponseSchema>;

// ---------------------------------------------------------------------------
// Question Config Union (ranked + benchmark)
// ---------------------------------------------------------------------------

export const questionConfigSchema = z.union([
  rankedConfigSchema,
  benchmarkQuestionConfigSchema,
]);

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

// ALL_QUESTION_TYPES and BENCHMARK_QUESTION_TYPES imported from benchmark-types.ts

const questionSchemaBase = z.object({
  title: z.string(),
  promptTemplate: z.string(),
  mode: z.enum(["STATELESS", "THREADED"]).optional(),
  threadKey: z.string().optional(),
  order: z.number().int().optional(),
  type: z.enum(ALL_QUESTION_TYPES).optional(),
  configJson: questionConfigSchema.optional(),
  // Benchmark metadata fields
  code: z.string().optional(),
  helpText: z.string().optional(),
  constructKey: z.string().optional(),
  sourceSurvey: z.string().optional(),
  sourceVariable: z.string().optional(),
  benchmarkNotes: z.string().optional(),
  isBenchmarkAnchor: z.boolean().optional(),
});

function validateQuestionConfig(data: { type?: string; configJson?: unknown }): boolean {
  const type = data.type;
  if (!type) return true;
  if (type === "OPEN_ENDED") return true;
  // RANKED and all benchmark types require configJson
  if (type === "RANKED" || (BENCHMARK_QUESTION_TYPES as readonly string[]).includes(type)) {
    if (data.configJson === undefined) return false;
    // Cross-check: benchmark config type must match question type
    if (type !== "RANKED") {
      const config = data.configJson as { type?: string };
      if (config.type !== type) return false;
    }
    return true;
  }
  return true;
}

export const createQuestionSchema = questionSchemaBase.refine(
  validateQuestionConfig,
  { message: "configJson is required for this question type", path: ["configJson"] },
);

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = questionSchemaBase.partial().refine(
  validateQuestionConfig,
  { message: "configJson is required for this question type", path: ["configJson"] },
);

export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

// ---------------------------------------------------------------------------
// Variable
// ---------------------------------------------------------------------------

export const createVariableSchema = z.object({
  key: z.string().regex(
    /^[a-zA-Z_][a-zA-Z0-9_]*$/,
    "Key must start with a letter or underscore and contain only alphanumeric characters and underscores"
  ),
  label: z.string().optional(),
  defaultValue: z.string().optional(),
});

export type CreateVariableInput = z.infer<typeof createVariableSchema>;

export const updateVariableSchema = createVariableSchema.partial();

export type UpdateVariableInput = z.infer<typeof updateVariableSchema>;

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

export const shareSurveySchema = z.object({
  email: z.email(),
  role: z.enum(["VIEW", "EDIT"]).optional(),
});

export type ShareSurveyInput = z.infer<typeof shareSurveySchema>;

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export const runConfigSchema = z.object({
  modelTargetIds: z.array(z.uuid()).optional(),
  variableOverrides: z.record(z.string(), z.string()).optional(),
});

export type RunConfigInput = z.infer<typeof runConfigSchema>;

export const estimateRunSchema = z.object({
  modelTargetIds: z.array(z.uuid()).min(1),
  variableOverrides: z.record(z.string(), z.string()).optional(),
});

export type EstimateRunInput = z.infer<typeof estimateRunSchema>;

// ---------------------------------------------------------------------------
// ModelTrust JSON fields (persisted as JSON columns, parsed at read boundaries)
// ---------------------------------------------------------------------------

export const penaltyBreakdownSchema = z.object({
  jsonInvalid: z.number(),
  emptyAnswer: z.number(),
  shortAnswer: z.number(),
  missingCitations: z.number(),
  latencyVariance: z.number(),
  costVariance: z.number(),
});

export const recommendationSchema = z.object({
  recommendedModelId: z.string().nullable(),
  recommendedModelName: z.string().nullable(),
  reliabilityScore: z.number().nullable(),
  reason: z.string(),
  humanReviewRequired: z.boolean(),
});

export const outlierModelsSchema = z.array(z.string());
export const overconfidentModelsSchema = z.array(z.string());

// ---------------------------------------------------------------------------
// Fact-check JSON column schemas
// ---------------------------------------------------------------------------

export const claimCategorySchema = z.enum(["percentage", "currency", "year", "rating", "month", "day_of_week", "full_date"]);

export const extractedClaimSchema = z.object({
  type: z.enum(["number", "percentage", "date", "assertion", "rating"]),
  category: claimCategorySchema.optional(),
  raw: z.string(),
  normalized: z.string(),
  value: z.number().optional(),
  scaleMax: z.number().optional(),
  normalizedScore: z.number().optional(),
});

export const citationAnalysisSchema = z.object({
  totalCitations: z.number(),
  hasValidUrls: z.boolean(),
  domains: z.array(z.string()),
});

export const claimsJsonSchema = z.array(extractedClaimSchema).nullable().catch(null);
export const citationAnalysisJsonSchema = citationAnalysisSchema.nullable().catch(null);
export const keySentencesJsonSchema = z.array(z.string()).nullable().catch(null);

export const factConfidenceSignalsSchema = z.array(z.string()).nullable().catch(null);

export const numericDisagreementSchema = z.object({
  claim: z.string(),
  category: claimCategorySchema.optional(),
  values: z.array(z.object({
    modelName: z.string(),
    value: z.number(),
    raw: z.string(),
  })),
  maxDelta: z.number(),
  meanValue: z.number(),
});

export const factComparisonSchema = z.object({
  numericDisagreements: z.array(numericDisagreementSchema),
  citationOverlap: z.number(),
  modelsWithCitations: z.number(),
  totalModels: z.number(),
  sharedDomains: z.array(z.string()),
  agreementSignals: z.array(z.string()),
  disagreementSignals: z.array(z.string()),
}).nullable().catch(null);

// Schemas for JSON columns read in compute-metrics handler
export const flagsJsonSchema = z.array(z.string()).nullable().catch([]);

export const parsedRankedSchema = z
  .object({ score: z.number() })
  .nullable()
  .catch(null);

export const parsedOpenEndedSchema = z
  .object({ answerText: z.string().optional() })
  .nullable()
  .catch(null);

export const parsedCategoricalSchema = z
  .object({ selectedValue: z.string() })
  .nullable()
  .catch(null);

export const parsedNumericScaleSchema = z
  .object({ score: z.number() })
  .nullable()
  .catch(null);

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export const verificationStatusSchema = z.enum([
  "UNREVIEWED",
  "VERIFIED",
  "INACCURATE",
]);

export type VerificationStatusInput = z.infer<typeof verificationStatusSchema>;

export const setVerificationSchema = z.object({
  responseId: z.string().uuid(),
  status: verificationStatusSchema,
});

export type SetVerificationInput = z.infer<typeof setVerificationSchema>;

// Extracts an optional confidence field from a parsedJson blob.
// Open-ended parsedJson may contain { answerText, citations, confidence, ... }.
// Ranked parsedJson only contains { score }, so this returns undefined for ranked.
export const confidenceFromJsonSchema = z
  .object({ confidence: z.number().min(0).max(100).optional() })
  .nullable()
  .catch(null);

// ---------------------------------------------------------------------------
// Truth Engine JSON fields
// ---------------------------------------------------------------------------

export const truthBreakdownSchema = z.object({
  baseScore: z.number(),
  consensusBonus: z.number(),
  citationBonus: z.number(),
  citationPenalty: z.number(),
  numericDisagreementPenalty: z.number(),
  assertionDisagreementPenalty: z.number(),
  emptyShortPenalty: z.number(),
  finalScore: z.number(),
});

export type TruthBreakdownPayload = z.infer<typeof truthBreakdownSchema>;

export const truthNumericDisagreementSchema = z.object({
  claimText: z.string(),
  values: z.array(
    z.object({
      modelKey: z.string(),
      value: z.number(),
      unit: z.string().optional(),
    })
  ),
  maxDelta: z.number(),
});

export const numericDisagreementsJsonSchema = z
  .array(truthNumericDisagreementSchema)
  .catch([]);

export const claimClusterSchema = z.object({
  clusterId: z.number(),
  kind: z.enum(["numeric", "assertion"]),
  claims: z.array(
    z.object({
      kind: z.enum(["numeric", "assertion"]),
      text: z.string(),
      modelKey: z.string(),
    })
  ),
  models: z.array(z.string()),
});

export const claimClustersJsonSchema = z.array(claimClusterSchema).catch([]);

export const refereeDisagreementSchema = z.object({
  type: z.enum(["numeric", "factual", "assumption"]),
  description: z.string(),
  models: z.array(z.string()),
  severity: z.enum(["low", "medium", "high"]),
});

export const refereeChecklistItemSchema = z.object({
  item: z.string(),
  why: z.string(),
  suggested_source: z.string(),
});

export const refereeDisagreementsJsonSchema = z
  .array(refereeDisagreementSchema)
  .catch([]);

export const refereeChecklistJsonSchema = z
  .array(refereeChecklistItemSchema)
  .catch([]);
