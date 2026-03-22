import { PrismaClient } from "@prisma/client";
import type { Job } from "@prisma/client";
import { handleExecuteQuestion } from "./handlers/execute-question";
import { handleAnalyzeResponse } from "./handlers/analyze-response";
import { handleExportRun } from "./handlers/export-run";
import { handleComputeMetrics } from "./handlers/compute-metrics";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// NOTE: Worker runs as standalone tsx process, can't use @/lib/env path alias.
// Direct process.env reads are an intentional exception to the env.ts convention.
const POLL_INTERVAL_MS = 2000;
const EXECUTE_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY_OPENAI ?? "5", 10);
const ANALYZE_CONCURRENCY = 10;
const EXPORT_CONCURRENCY = 2;
const METRICS_CONCURRENCY = 2;

// Jobs stuck in RUNNING longer than this are presumed orphaned (worker crash)
const STALE_JOB_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const STALE_JOB_CHECK_INTERVAL_MS = 30 * 1000; // check every 30s

// ---------------------------------------------------------------------------
// Worker state
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();
let running = true;
const activeJobs = new Set<string>();
let lastStaleCheck = 0;

// ---------------------------------------------------------------------------
// Job claimer - atomically claim a PENDING job by updating status to RUNNING
// ---------------------------------------------------------------------------

async function claimJob(
  type: "EXECUTE_QUESTION" | "ANALYZE_RESPONSE" | "EXPORT_RUN" | "COMPUTE_METRICS",
  maxActive: number
): Promise<Job | null> {
  // Count how many of this type we're currently processing
  const activeOfType = [...activeJobs].filter((id) => id.startsWith(type)).length;
  if (activeOfType >= maxActive) return null;

  // Find and claim a PENDING job atomically using a raw query for MySQL
  // We use updateMany with a limit-like pattern to avoid race conditions
  // Extract plain job IDs from tracking keys (format: "TYPE:ID")
  const activeJobIds = [...activeJobs].map((key) => key.split(":").slice(1).join(":"));
  const pendingJob = await prisma.job.findFirst({
    where: {
      type,
      status: "PENDING",
      ...(activeJobIds.length > 0 ? { id: { notIn: activeJobIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  if (!pendingJob) return null;

  // Attempt to claim it (optimistic locking via status check)
  const updated = await prisma.job.updateMany({
    where: {
      id: pendingJob.id,
      status: "PENDING", // Only claim if still PENDING
    },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      attempt: { increment: 1 },
    },
  });

  if (updated.count === 0) return null; // Someone else claimed it

  // Re-fetch with updated status
  return prisma.job.findUnique({ where: { id: pendingJob.id } });
}

// ---------------------------------------------------------------------------
// Process a single job
// ---------------------------------------------------------------------------

async function processJob(job: Job): Promise<void> {
  const trackingKey = `${job.type}:${job.id}`;
  activeJobs.add(trackingKey);

  try {
    const payload = job.payloadJson as Record<string, unknown>;

    switch (job.type) {
      case "EXECUTE_QUESTION":
        // Fields from payloadJson are deserialized from raw JSON; the handler
        // narrows types internally, so we forward them with minimal casting.
        await handleExecuteQuestion({
          jobId: job.id,
          runId: job.runId,
          modelTargetId: job.modelTargetId,
          questionId: job.questionId ?? "",
          threadKey: job.threadKey,
          renderedPrompt: (payload.renderedPrompt as string) ?? "",
          questionMode: (payload.questionMode as string) ?? "STATELESS",
          questionType: (payload.questionType ?? "OPEN_ENDED") as Parameters<typeof handleExecuteQuestion>[0]["questionType"],
          questionConfig: payload.questionConfig as Parameters<typeof handleExecuteQuestion>[0]["questionConfig"],
          matrixRowKey: payload.matrixRowKey as string | undefined,
          matrixRowLabel: payload.matrixRowLabel as string | undefined,
        });
        break;

      case "ANALYZE_RESPONSE":
        await handleAnalyzeResponse({
          jobId: job.id,
          responseId: (payload.responseId as string) ?? "",
          runId: job.runId,
        });
        break;

      case "EXPORT_RUN":
        await handleExportRun({
          runId: job.runId,
        });
        break;

      case "COMPUTE_METRICS":
        await handleComputeMetrics({
          runId: job.runId,
          jobId: job.id,
        });
        break;
    }
  } catch (err) {
    console.error(`[worker] Job ${job.id} (${job.type}) failed:`, err);
    // Handler should have already marked it as FAILED, but ensure it
    try {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          lastError: err instanceof Error ? err.message : "Unknown error",
        },
      });
    } catch {
      // Already updated by handler
    }
  } finally {
    activeJobs.delete(trackingKey);
  }
}

// ---------------------------------------------------------------------------
// Stale job recovery - reset orphaned RUNNING jobs back to PENDING
// ---------------------------------------------------------------------------

async function recoverStaleJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_JOB_TIMEOUT_MS);

  // Don't reset jobs this worker is actively processing
  const activeJobIds = [...activeJobs].map((key) => key.split(":").slice(1).join(":"));

  const staleJobs = await prisma.job.findMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: cutoff },
      ...(activeJobIds.length > 0 ? { id: { notIn: activeJobIds } } : {}),
    },
    select: { id: true, type: true, runId: true, attempt: true },
  });

  for (const job of staleJobs) {
    // Reset to PENDING so the poll loop picks it up again
    const updated = await prisma.job.updateMany({
      where: { id: job.id, status: "RUNNING" },
      data: {
        status: "PENDING",
        startedAt: null,
        lastError: `Recovered from stale RUNNING state (attempt ${job.attempt})`,
      },
    });

    if (updated.count > 0) {
      console.warn(
        `[worker] Recovered stale job ${job.id} (${job.type}, run ${job.runId}) — reset to PENDING`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

async function pollLoop(): Promise<void> {
  console.log("[worker] Starting poll loop...");

  while (running) {
    // Periodically check for stale RUNNING jobs (orphaned by crashes)
    const now = Date.now();
    if (now - lastStaleCheck >= STALE_JOB_CHECK_INTERVAL_MS) {
      lastStaleCheck = now;
      try {
        await recoverStaleJobs();
      } catch (err) {
        console.error("[worker] Error recovering stale jobs:", err);
      }
    }

    let claimed = false;

    // Try to claim jobs of each type
    const executeJob = await claimJob("EXECUTE_QUESTION", EXECUTE_CONCURRENCY);
    if (executeJob) {
      claimed = true;
      // Process in background (don't await - allows concurrency)
      void processJob(executeJob);
    }

    const analyzeJob = await claimJob("ANALYZE_RESPONSE", ANALYZE_CONCURRENCY);
    if (analyzeJob) {
      claimed = true;
      void processJob(analyzeJob);
    }

    const exportJob = await claimJob("EXPORT_RUN", EXPORT_CONCURRENCY);
    if (exportJob) {
      claimed = true;
      void processJob(exportJob);
    }

    const metricsJob = await claimJob("COMPUTE_METRICS", METRICS_CONCURRENCY);
    if (metricsJob) {
      claimed = true;
      void processJob(metricsJob);
    }

    // If we didn't claim anything, wait before polling again
    if (!claimed) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[worker] MySQL-backed job worker starting...");
  console.log(`[worker] Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`[worker] Concurrency - Execute: ${EXECUTE_CONCURRENCY}, Analyze: ${ANALYZE_CONCURRENCY}, Export: ${EXPORT_CONCURRENCY}, Metrics: ${METRICS_CONCURRENCY}`);

  await pollLoop();
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Received ${signal}, shutting down...`);
  running = false;

  // Wait for active jobs to finish (max 30s)
  const deadline = Date.now() + 30_000;
  while (activeJobs.size > 0 && Date.now() < deadline) {
    console.log(`[worker] Waiting for ${activeJobs.size} active jobs...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  await prisma.$disconnect();
  console.log("[worker] Shut down gracefully");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
