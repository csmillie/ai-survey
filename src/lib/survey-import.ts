import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { QuestionType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Import JSON Schema (Zod validation for the incoming file)
// ---------------------------------------------------------------------------

const importOptionSchema = z.object({
  value: z.union([z.string(), z.boolean()]),
  label: z.string(),
  score: z.number().optional(),
});

const importScaleSchema = z.object({
  min: z.number(),
  max: z.number(),
  min_label: z.string().optional(),
  max_label: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

const importBenchmarkSchema = z.object({
  geography: z.string().optional(),
  distribution: z.record(z.string(), z.number()).optional(),
  mean: z.number().optional(),
  std_dev: z.number().optional(),
}).passthrough();

const importQuestionSchema = z.object({
  id: z.string(),
  section: z.string().optional(),
  order: z.number(),
  source: z.string().optional(),
  source_variable: z.string().optional(),
  question_type: z.string(),
  text: z.string(),
  options: z.array(importOptionSchema).optional(),
  scale: importScaleSchema.optional(),
  benchmark: importBenchmarkSchema.optional(),
  tags: z.array(z.string()).optional(),
});

const importIndexSchema = z.object({
  id: z.string(),
  name: z.string(),
  question_ids: z.array(z.string()),
  method: z.string(),
});

export const importSurveyJsonSchema = z.object({
  survey_id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  language: z.string().optional(),
  default_mode: z.string().optional(),
  benchmark_sources: z.array(z.string()).optional(),
  intended_use: z.array(z.string()).optional(),
  execution_defaults: z.record(z.string(), z.unknown()).optional(),
  questions: z.array(importQuestionSchema).min(1),
  indices: z.array(importIndexSchema).optional(),
});

export type ImportSurveyJson = z.infer<typeof importSurveyJsonSchema>;
type ImportQuestion = z.infer<typeof importQuestionSchema>;

// ---------------------------------------------------------------------------
// Question Type Mapping
// ---------------------------------------------------------------------------

const TYPE_MAP: Record<string, QuestionType> = {
  categorical_single_select: "SINGLE_SELECT",
  boolean_yes_no: "BINARY",
  forced_choice: "FORCED_CHOICE",
  likert_scale: "LIKERT",
  integer_scale: "NUMERIC_SCALE",
};

// ---------------------------------------------------------------------------
// Config Builders
// ---------------------------------------------------------------------------

function buildSingleSelectConfig(q: ImportQuestion): Prisma.InputJsonValue {
  const options = (q.options ?? []).map((o) => ({
    label: o.label,
    value: String(o.value),
    numericValue: o.score,
  }));
  return { type: "SINGLE_SELECT", options } as unknown as Prisma.InputJsonValue;
}

function buildBinaryConfig(q: ImportQuestion): Prisma.InputJsonValue {
  const options = (q.options ?? []).map((o) => ({
    label: o.label,
    value: o.value === true ? "yes" : o.value === false ? "no" : String(o.value),
    numericValue: o.score,
  }));
  return {
    type: "BINARY",
    options: [options[0], options[1]],
  } as unknown as Prisma.InputJsonValue;
}

function buildForcedChoiceConfig(q: ImportQuestion): Prisma.InputJsonValue {
  const options = (q.options ?? []).map((o) => ({
    label: o.label,
    value: String(o.value),
    numericValue: o.score,
  }));
  return {
    type: "FORCED_CHOICE",
    options: [options[0], options[1]],
  } as unknown as Prisma.InputJsonValue;
}

function buildLikertConfig(q: ImportQuestion): Prisma.InputJsonValue {
  const scale = q.scale;
  if (!scale || !scale.labels) {
    throw new Error(`LIKERT question ${q.id} missing scale.labels`);
  }
  const points = scale.labels.length as 4 | 5 | 7;
  const options = scale.labels.map((label, i) => ({
    label,
    value: label.toLowerCase().replace(/\s+/g, "_"),
    numericValue: scale.min + i,
  }));
  return { type: "LIKERT", points, options } as unknown as Prisma.InputJsonValue;
}

function buildNumericScaleConfig(q: ImportQuestion): Prisma.InputJsonValue {
  const scale = q.scale;
  if (!scale) {
    throw new Error(`NUMERIC_SCALE question ${q.id} missing scale`);
  }
  return {
    type: "NUMERIC_SCALE",
    min: scale.min,
    max: scale.max,
    minLabel: scale.min_label ?? "",
    maxLabel: scale.max_label ?? "",
  } as unknown as Prisma.InputJsonValue;
}

const CONFIG_BUILDERS: Record<string, (q: ImportQuestion) => Prisma.InputJsonValue> = {
  categorical_single_select: buildSingleSelectConfig,
  boolean_yes_no: buildBinaryConfig,
  forced_choice: buildForcedChoiceConfig,
  likert_scale: buildLikertConfig,
  integer_scale: buildNumericScaleConfig,
};

// ---------------------------------------------------------------------------
// Mapped Output Types
// ---------------------------------------------------------------------------

export interface MappedSurvey {
  title: string;
  description: string | undefined;
  isBenchmarkInstrument: boolean;
  benchmarkSource: string | undefined;
  benchmarkVersion: string | undefined;
  executionMode: string;
  questions: MappedQuestion[];
}

export interface MappedQuestion {
  title: string;
  promptTemplate: string;
  order: number;
  type: QuestionType;
  configJson: Prisma.InputJsonValue;
  code: string | null;
  constructKey: string | null;
  sourceSurvey: string | null;
  sourceVariable: string | null;
  isBenchmarkAnchor: boolean;
  benchmarkNotes: string | null;
}

// ---------------------------------------------------------------------------
// Main Mapping Function
// ---------------------------------------------------------------------------

export function mapImportToSurvey(input: ImportSurveyJson): MappedSurvey {
  // Build description with indices appendix
  let description = input.description ?? "";
  if (input.indices && input.indices.length > 0) {
    description += "\n\n## Composite Indices\n";
    for (const idx of input.indices) {
      description += `\n**${idx.name}** (${idx.method}): ${idx.question_ids.join(", ")}`;
    }
  }

  const questions: MappedQuestion[] = input.questions.map((q) => {
    const ourType = TYPE_MAP[q.question_type];
    if (!ourType) {
      throw new Error(
        `Unknown question type "${q.question_type}" on question ${q.id}. ` +
        `Supported types: ${Object.keys(TYPE_MAP).join(", ")}`
      );
    }

    const configBuilder = CONFIG_BUILDERS[q.question_type];
    const configJson = configBuilder(q);

    const tags = q.tags ?? [];
    const benchmarkNotes = q.benchmark
      ? JSON.stringify(q.benchmark)
      : null;

    return {
      title: q.text.slice(0, 60).trim() || `Question ${q.id}`,
      promptTemplate: q.text,
      order: q.order,
      type: ourType,
      configJson,
      code: q.id,
      constructKey: q.section ?? null,
      sourceSurvey: q.source ?? null,
      sourceVariable: q.source_variable ?? null,
      isBenchmarkAnchor: tags.includes("anchor"),
      benchmarkNotes,
    };
  });

  return {
    title: input.title,
    description: description.trim() || undefined,
    isBenchmarkInstrument: true,
    benchmarkSource: input.benchmark_sources?.join(", "),
    benchmarkVersion: input.version,
    executionMode: input.default_mode === "deterministic" ? "deterministic" : "standard",
    questions,
  };
}
