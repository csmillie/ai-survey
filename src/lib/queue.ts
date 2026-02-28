import { prisma } from "@/lib/db";
import type { AllocationJob } from "@/lib/allocation";

// ---------------------------------------------------------------------------
// Queue Names (job types, mapped to JobType enum in Prisma)
// ---------------------------------------------------------------------------

export const QUEUE_NAMES = {
  EXECUTE_QUESTION: "EXECUTE_QUESTION",
  ANALYZE_RESPONSE: "ANALYZE_RESPONSE",
  EXPORT_RUN: "EXPORT_RUN",
} as const;

// ---------------------------------------------------------------------------
// Payload Types
// ---------------------------------------------------------------------------

export interface ExecuteQuestionPayload {
  jobId: string;
  runId: string;
  modelTargetId: string;
  questionId: string;
  threadKey: string;
  renderedPrompt: string;
  questionMode: string;
  questionType?: string;
  questionConfig?: {
    scalePreset: string;
    scaleMin: number;
    scaleMax: number;
    includeReasoning: boolean;
  };
}

export interface AnalyzeResponsePayload {
  jobId: string;
  responseId: string;
  runId: string;
}

export interface ExportRunPayload {
  runId: string;
}

// ---------------------------------------------------------------------------
// Enqueue helpers
// ---------------------------------------------------------------------------

/**
 * For MySQL-backed queue, jobs are already created in the Job table with
 * PENDING status by the startRunAction. This function is a no-op since
 * the worker polls the Job table directly.
 *
 * Kept for API compatibility with the rest of the codebase.
 */
export async function enqueueRunJobsWithIds(
  _runId: string,
  _jobs: AllocationJob[],
  _idempotencyKeyToJobId: Map<string, string>
): Promise<void> {
  // Jobs are already in the DB with PENDING status.
  // The worker will pick them up via polling.
}

/**
 * Enqueue an ANALYZE_RESPONSE job by creating a Job row in the database.
 */
export async function enqueueAnalyzeJob(params: {
  runId: string;
  responseId: string;
  modelTargetId: string;
}): Promise<void> {
  await prisma.job.create({
    data: {
      runId: params.runId,
      modelTargetId: params.modelTargetId,
      threadKey: `analyze-${params.responseId}`,
      type: "ANALYZE_RESPONSE",
      status: "PENDING",
      idempotencyKey: `analyze:${params.responseId}`,
      payloadJson: {
        responseId: params.responseId,
        runId: params.runId,
      },
    },
  });
}

/**
 * Enqueue an EXPORT_RUN job by creating a Job row in the database.
 */
export async function enqueueExportJob(params: {
  runId: string;
  modelTargetId: string;
}): Promise<void> {
  const idempotencyKey = `export:${params.runId}:${Date.now()}`;
  await prisma.job.create({
    data: {
      runId: params.runId,
      modelTargetId: params.modelTargetId,
      threadKey: `export-${params.runId}`,
      type: "EXPORT_RUN",
      status: "PENDING",
      idempotencyKey,
      payloadJson: {
        runId: params.runId,
      },
    },
  });
}
