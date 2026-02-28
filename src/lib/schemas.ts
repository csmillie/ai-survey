import { z } from "zod";

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
  notes: z.string().optional(),
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
  "1-5": { min: 1, max: 5 },
  "1-10": { min: 1, max: 10 },
  "1-100": { min: 1, max: 100 },
  "percentage": { min: 0, max: 100 },
} as const;

export type ScalePreset = keyof typeof SCALE_PRESETS;

export const rankedConfigSchema = z.object({
  scalePreset: z.enum(["1-5", "1-10", "1-100", "percentage"]),
  scaleMin: z.number().int().min(0),
  scaleMax: z.number().int().min(1),
  includeReasoning: z.boolean(),
}).refine((data) => data.scaleMin < data.scaleMax, {
  message: "scaleMin must be less than scaleMax",
  path: ["scaleMin"],
});

export type RankedConfig = z.infer<typeof rankedConfigSchema>;

export const rankedResponseSchema = z.object({
  score: z.number(),
  reasoning: z.string().optional(),
});

export type RankedResponsePayload = z.infer<typeof rankedResponseSchema>;

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export const createQuestionSchema = z.object({
  title: z.string(),
  promptTemplate: z.string(),
  mode: z.enum(["STATELESS", "THREADED"]).optional(),
  threadKey: z.string().optional(),
  order: z.number().int().optional(),
  type: z.enum(["OPEN_ENDED", "RANKED"]).optional(),
  configJson: rankedConfigSchema.optional(),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = createQuestionSchema.partial();

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
