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

  // 1. Load questions ordered by `order ASC`
  const questions = await prisma.question.findMany({
    where: { surveyId },
    orderBy: { order: "asc" },
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
      // a. Generate threadKey
      const threadKey =
        question.mode === "THREADED"
          ? `${runId}-${modelTargetId}-${question.threadKey || question.id}`
          : `${runId}-${modelTargetId}-${question.id}`;

      // b. Generate idempotencyKey
      const idempotencyKey = `${runId}:${modelTargetId}:${question.id}`;

      // c. Substitute variables in promptTemplate
      const { result: renderedPrompt } = substituteVariables(
        question.promptTemplate,
        variableMap
      );

      // d. Create AllocationJob
      jobs.push({
        modelTargetId,
        questionId: question.id,
        threadKey,
        idempotencyKey,
        type: "EXECUTE_QUESTION",
        payloadJson: {
          questionTitle: question.title,
          renderedPrompt,
          questionMode: question.mode,
          threadKey,
          variableValues: variableMap,
        },
      });
    }
  }

  // 5. Return result
  return {
    jobs,
    totalJobs: jobs.length,
  };
}
