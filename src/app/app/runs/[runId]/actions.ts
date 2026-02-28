"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canAccessSurvey } from "@/lib/survey-auth";
import { enqueueExportJob } from "@/lib/queue";
import { createAuditEvent, RUN_CANCELLED } from "@/lib/audit";

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
