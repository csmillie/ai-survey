import { prisma } from "@/lib/db";
import { substituteVariables } from "@/lib/variable-substitution";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AllocationJob {
  modelTargetId: string;
  questionId: string;
  threadKey: string;
  idempotencyKey: string;
  type: "EXECUTE_QUESTION";
  payloadJson: Record<string, unknown>;
}

export interface AllocationResult {
  jobs: AllocationJob[];
  totalJobs: number;
}

// ---------------------------------------------------------------------------
// Allocation Engine
// ---------------------------------------------------------------------------

/**
 * Deterministically allocate jobs for a survey run.
 *
 * The allocation produces a stable ordering: models (outer) x questions (inner),
 * with each job receiving a unique idempotency key to prevent duplicates.
 */
export async function allocateJobs(params: {
  runId: string;
  surveyId: string;
  modelTargetIds: string[];
  variableOverrides?: Record<string, string>;
}): Promise<AllocationResult> {
  const { runId, surveyId, modelTargetIds, variableOverrides } = params;

  // 1. Load questions ordered by `order ASC`, with matrix rows for expansion
  const questions = await prisma.question.findMany({
    where: { surveyId },
    orderBy: { order: "asc" },
    include: {
      matrixRows: { orderBy: { order: "asc" } },
    },
  });

  // 2. Load variables for the survey
  const variables = await prisma.variable.findMany({
    where: { surveyId },
  });

  // 3. Build variable map: merge defaults with overrides
  const variableMap: Record<string, string> = {};
  for (const variable of variables) {
    if (variable.defaultValue !== null) {
      variableMap[variable.key] = variable.defaultValue;
    }
  }
  if (variableOverrides) {
    for (const [key, value] of Object.entries(variableOverrides)) {
      variableMap[key] = value;
    }
  }

  // 4. Stable double loop: models (outer), questions (inner)
  const jobs: AllocationJob[] = [];

  for (const modelTargetId of modelTargetIds) {
    for (const question of questions) {
      // Substitute variables in promptTemplate
      const { result: renderedPrompt } = substituteVariables(
        question.promptTemplate,
        variableMap
      );

      const basePayload = {
        questionTitle: question.title,
        renderedPrompt,
        questionMode: question.mode,
        variableValues: variableMap,
        questionType: question.type ?? "OPEN_ENDED",
        ...(question.configJson ? { questionConfig: question.configJson } : {}),
      };

      // MATRIX_LIKERT: one job per row
      if (question.type === "MATRIX_LIKERT") {
        if (question.matrixRows.length === 0) {
          console.warn(
            `[allocation] MATRIX_LIKERT question ${question.id} has no rows — skipping`
          );
          continue;
        }
        for (const row of question.matrixRows) {
          const threadKey = `${runId}-${modelTargetId}-${question.id}-${row.rowKey}`;
          const idempotencyKey = `${runId}:${modelTargetId}:${question.id}:${row.rowKey}`;

          jobs.push({
            modelTargetId,
            questionId: question.id,
            threadKey,
            idempotencyKey,
            type: "EXECUTE_QUESTION",
            payloadJson: {
              ...basePayload,
              matrixRowKey: row.rowKey,
              matrixRowLabel: row.label,
            },
          });
        }
      } else {
        // All other types: one job per question
        const threadKey =
          question.mode === "THREADED"
            ? `${runId}-${modelTargetId}-${question.threadKey || question.id}`
            : `${runId}-${modelTargetId}-${question.id}`;
        const idempotencyKey = `${runId}:${modelTargetId}:${question.id}`;

        jobs.push({
          modelTargetId,
          questionId: question.id,
          threadKey,
          idempotencyKey,
          type: "EXECUTE_QUESTION",
          payloadJson: {
            ...basePayload,
            threadKey,
          },
        });
      }
    }
  }

  // 5. Return result
  return {
    jobs,
    totalJobs: jobs.length,
  };
}
