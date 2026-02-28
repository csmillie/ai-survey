import { prisma } from "@/lib/db";
import type { Decimal } from "@prisma/client/runtime/library";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelEstimate {
  modelTargetId: string;
  modelName: string;
  provider: string;
  jobCount: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
}

export interface RunEstimate {
  totalQuestions: number;
  totalModels: number;
  totalJobs: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  estimatedCostUsd: number;
  perModel: ModelEstimate[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Average estimated input tokens per question prompt. */
const AVG_INPUT_TOKENS_PER_QUESTION = 500;

/** Average estimated output tokens per question response. */
const AVG_OUTPUT_TOKENS_PER_QUESTION = 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decimalToNumber(value: Decimal): number {
  return Number(value);
}

function calculateModelCostUsd(
  inputTokens: number,
  outputTokens: number,
  inputCostPerMillionTokens: Decimal,
  outputCostPerMillionTokens: Decimal,
): number {
  return (
    (inputTokens * decimalToNumber(inputCostPerMillionTokens)) / 1_000_000 +
    (outputTokens * decimalToNumber(outputCostPerMillionTokens)) / 1_000_000
  );
}

// ---------------------------------------------------------------------------
// Estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the cost and token usage for a survey run.
 *
 * Uses average token estimates per question to project total costs
 * based on model pricing.
 */
export async function estimateRun(params: {
  surveyId: string;
  modelTargetIds: string[];
}): Promise<RunEstimate> {
  const { surveyId, modelTargetIds } = params;

  // 1. Load questions for survey
  const questionCount = await prisma.question.count({
    where: { surveyId },
  });

  // 2. Load model targets by IDs
  const modelTargets = await prisma.modelTarget.findMany({
    where: {
      id: { in: modelTargetIds },
    },
  });

  // 3. Build per-model estimates
  const perModel: ModelEstimate[] = [];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;
  let totalJobs = 0;

  for (const model of modelTargets) {
    const jobCount = questionCount;
    const estimatedInputTokens = jobCount * AVG_INPUT_TOKENS_PER_QUESTION;
    const estimatedOutputTokens = jobCount * AVG_OUTPUT_TOKENS_PER_QUESTION;

    const estimatedCostUsd = calculateModelCostUsd(
      estimatedInputTokens,
      estimatedOutputTokens,
      model.inputTokenCostUsd,
      model.outputTokenCostUsd,
    );

    perModel.push({
      modelTargetId: model.id,
      modelName: model.modelName,
      provider: model.provider,
      jobCount,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostUsd,
    });

    totalInputTokens += estimatedInputTokens;
    totalOutputTokens += estimatedOutputTokens;
    totalCostUsd += estimatedCostUsd;
    totalJobs += jobCount;
  }

  return {
    totalQuestions: questionCount,
    totalModels: modelTargets.length,
    totalJobs,
    estimatedInputTokens: totalInputTokens,
    estimatedOutputTokens: totalOutputTokens,
    estimatedTotalTokens: totalInputTokens + totalOutputTokens,
    estimatedCostUsd: totalCostUsd,
    perModel,
  };
}
