"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canAccessSurvey } from "@/lib/survey-auth";
import { enqueueExportJob } from "@/lib/queue";
import { createAuditEvent, RUN_CANCELLED, RESPONSE_VERIFIED } from "@/lib/audit";
import { setVerificationSchema } from "@/lib/schemas";
import type { DriftPoint } from "./types";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

interface ActionSuccess {
  success: true;
}

interface ActionError {
  success: false;
  error: string;
}

type ActionResult = ActionSuccess | ActionError;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadRunWithAccessCheck(
  userId: string,
  runId: string
): Promise<
  | { run: { id: string; surveyId: string; status: string; createdById: string } }
  | { error: string }
> {
  const run = await prisma.surveyRun.findUnique({
    where: { id: runId },
    select: { id: true, surveyId: true, status: true, createdById: true },
  });

  if (!run) {
    return { error: "Run not found" };
  }

  const hasAccess = await canAccessSurvey(userId, run.surveyId, "VIEW");
  if (!hasAccess) {
    return { error: "Access denied" };
  }

  return { run };
}

// ---------------------------------------------------------------------------
// cancelRunAction
// ---------------------------------------------------------------------------

export async function cancelRunAction(runId: string): Promise<ActionResult> {
  const session = await requireSession();

  const result = await loadRunWithAccessCheck(session.userId, runId);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { run } = result;

  // Only cancel if QUEUED or RUNNING
  if (run.status !== "QUEUED" && run.status !== "RUNNING") {
    return {
      success: false,
      error: `Cannot cancel a run with status ${run.status}`,
    };
  }

  // 1. Update run status to CANCELLED
  await prisma.surveyRun.update({
    where: { id: runId },
    data: {
      status: "CANCELLED",
      completedAt: new Date(),
    },
  });

  // 2. Cancel all PENDING jobs
  await prisma.job.updateMany({
    where: {
      runId,
      status: { in: ["PENDING", "RETRYING"] },
    },
    data: {
      status: "CANCELLED",
      finishedAt: new Date(),
    },
  });

  // 3. Audit log
  await createAuditEvent({
    actorUserId: session.userId,
    action: RUN_CANCELLED,
    targetType: "SurveyRun",
    targetId: runId,
    runTargetId: runId,
  });

  revalidatePath(`/app/runs/${runId}`);

  return { success: true };
}

// ---------------------------------------------------------------------------
// exportRunAction
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// getResponseDebugData
// ---------------------------------------------------------------------------

const requestMessagesSchema = z.array(
  z.object({ role: z.string(), content: z.string() })
);

const usageJsonSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
});

interface DebugDataResult {
  success: true;
  rawText: string;
  requestMessages: Array<{ role: string; content: string }> | null;
  usageJson: { inputTokens: number; outputTokens: number } | null;
}

export async function getResponseDebugData(
  responseId: string
): Promise<DebugDataResult | ActionError> {
  const session = await requireSession();

  const resp = await prisma.llmResponse.findUnique({
    where: { id: responseId },
    select: {
      rawText: true,
      requestMessagesJson: true,
      usageJson: true,
      run: { select: { surveyId: true } },
    },
  });

  if (!resp) {
    return { success: false, error: "Response not found" };
  }

  const hasAccess = await canAccessSurvey(session.userId, resp.run.surveyId, "VIEW");
  if (!hasAccess) {
    return { success: false, error: "Access denied" };
  }

  const msgResult = requestMessagesSchema.safeParse(resp.requestMessagesJson);
  const usageResult = usageJsonSchema.safeParse(resp.usageJson);

  return {
    success: true,
    rawText: resp.rawText,
    requestMessages: msgResult.success ? msgResult.data : null,
    usageJson: usageResult.success ? usageResult.data : null,
  };
}

// ---------------------------------------------------------------------------
// exportRunAction
// ---------------------------------------------------------------------------

export async function exportRunAction(runId: string): Promise<ActionResult> {
  const session = await requireSession();

  const result = await loadRunWithAccessCheck(session.userId, runId);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { run } = result;

  // Only export completed runs
  if (run.status !== "COMPLETED") {
    return {
      success: false,
      error: `Cannot export a run with status ${run.status}`,
    };
  }

  // Get any model target from the run for the job's required field
  const runModel = await prisma.runModel.findFirst({
    where: { runId },
    select: { modelTargetId: true },
  });

  if (!runModel) {
    return { success: false, error: "No models found for this run" };
  }

  // Enqueue export job via database
  await enqueueExportJob({
    runId,
    modelTargetId: runModel.modelTargetId,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// setVerificationStatusAction
// ---------------------------------------------------------------------------

export async function setVerificationStatusAction(
  responseId: string,
  status: string
): Promise<ActionResult> {
  const parsed = setVerificationSchema.safeParse({ responseId, status });
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  const session = await requireSession();

  const resp = await prisma.llmResponse.findUnique({
    where: { id: parsed.data.responseId },
    select: { id: true, runId: true, run: { select: { surveyId: true } } },
  });

  if (!resp) {
    return { success: false, error: "Response not found" };
  }

  const hasAccess = await canAccessSurvey(session.userId, resp.run.surveyId, "EDIT");
  if (!hasAccess) {
    return { success: false, error: "Access denied" };
  }

  // Toggle: if already set to this status, revert to UNREVIEWED
  const newStatus =
    parsed.data.status === "UNREVIEWED"
      ? "UNREVIEWED"
      : parsed.data.status;

  await prisma.llmResponse.update({
    where: { id: parsed.data.responseId },
    data: {
      verificationStatus: newStatus,
      verifiedAt: newStatus === "UNREVIEWED" ? null : new Date(),
      verifiedByUserId: newStatus === "UNREVIEWED" ? null : session.userId,
    },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: RESPONSE_VERIFIED,
    targetType: "LlmResponse",
    targetId: parsed.data.responseId,
    meta: { status: newStatus },
    runTargetId: resp.runId,
  });

  revalidatePath(`/app/runs/${resp.runId}`);

  return { success: true };
}

// ---------------------------------------------------------------------------
// getDriftDataAction
// ---------------------------------------------------------------------------

interface DriftDataSuccess {
  success: true;
  data: DriftPoint[];
}

const runIdSchema = z.string().uuid();

export async function getDriftDataAction(
  runId: string
): Promise<DriftDataSuccess | ActionError> {
  const parsed = runIdSchema.safeParse(runId);
  if (!parsed.success) {
    return { success: false, error: "Invalid run ID" };
  }

  const session = await requireSession();

  // Load the current run to get its surveyId
  const currentRun = await prisma.surveyRun.findUnique({
    where: { id: runId },
    select: { surveyId: true },
  });

  if (!currentRun) {
    return { success: false, error: "Run not found" };
  }

  const hasAccess = await canAccessSurvey(
    session.userId,
    currentRun.surveyId,
    "VIEW"
  );
  if (!hasAccess) {
    return { success: false, error: "Access denied" };
  }

  // Load last 10 completed runs with metrics for this survey
  const runs = await prisma.surveyRun.findMany({
    where: {
      surveyId: currentRun.surveyId,
      status: "COMPLETED",
      completedAt: { not: null },
      modelMetrics: { some: {} },
    },
    select: {
      id: true,
      completedAt: true,
      modelMetrics: {
        select: {
          reliabilityScore: true,
          modelTarget: {
            select: { modelName: true },
          },
        },
      },
    },
    orderBy: { completedAt: "desc" },
    take: 10,
  });

  // Transform into DriftPoint format (chronological order).
  // We use desc + take(10) + reverse() because asc + take(10) would return the
  // oldest 10 runs, not the most recent 10.
  const data: DriftPoint[] = runs
    .reverse()
    .map((r) => {
      const models: Record<string, number> = {};
      for (const m of r.modelMetrics) {
        models[m.modelTarget.modelName] = m.reliabilityScore;
      }
      return {
        runDate: r.completedAt!.toISOString(),
        models,
      };
    });

  return { success: true, data };
}
