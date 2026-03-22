import { prisma } from "@/lib/db";
import type { AllocationJob } from "@/lib/allocation";
import type { RankedConfig } from "@/lib/schemas";
import type { BenchmarkQuestionConfig } from "@/lib/benchmark-types";

// ---------------------------------------------------------------------------
// Queue Names (job types, mapped to JobType enum in Prisma)
// ---------------------------------------------------------------------------

export const QUEUE_NAMES = {
  EXECUTE_QUESTION: "EXECUTE_QUESTION",
  ANALYZE_RESPONSE: "ANALYZE_RESPONSE",
  EXPORT_RUN: "EXPORT_RUN",
  COMPUTE_METRICS: "COMPUTE_METRICS",
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
  /** Raw from JSON column — handler validates with Zod before use. */
  questionType?: string;
  questionConfig?: RankedConfig | BenchmarkQuestionConfig | Record<string, unknown>;
  matrixRowKey?: string;
  matrixRowLabel?: string;
}

export interface AnalyzeResponsePayload {
  jobId: string;
  responseId: string;
  runId: string;
}

export interface ExportRunPayload {
  runId: string;
}

export interface ComputeMetricsPayload {
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

/**
 * Enqueue a COMPUTE_METRICS job by creating a Job row in the database.
 *
 * Note: `modelTargetId` is not used by the handler (it processes all models
 * for the run), but is required to satisfy the Job table's foreign key
 * constraint. Callers should pass any valid modelTargetId from the run.
 */
export async function enqueueComputeMetricsJob(params: {
  runId: string;
  modelTargetId: string;
}): Promise<void> {
  const idempotencyKey = `compute-metrics:${params.runId}`;
  await prisma.job.create({
    data: {
      runId: params.runId,
      modelTargetId: params.modelTargetId,
      threadKey: `compute-metrics-${params.runId}`,
      type: "COMPUTE_METRICS",
      status: "PENDING",
      idempotencyKey,
      payloadJson: {
        runId: params.runId,
      },
    },
  });
}
