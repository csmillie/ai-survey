"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireSurveyAccess } from "@/lib/survey-auth";
import { estimateRunSchema } from "@/lib/schemas";
import { estimateRun, type RunEstimate } from "@/lib/estimation";
import { allocateJobs } from "@/lib/allocation";
import { enqueueRunJobsWithIds } from "@/lib/queue";
import { createAuditEvent, RUN_STARTED } from "@/lib/audit";
import { getMaxTokensPerRun, getMaxCostPerRunUsd } from "@/lib/env";

// ---------------------------------------------------------------------------
// Action result types
// ---------------------------------------------------------------------------

interface EstimateActionSuccess {
  success: true;
  estimate: RunEstimate;
}

interface ActionError {
  success: false;
  error: string;
}

type EstimateActionResult = EstimateActionSuccess | ActionError;

interface StartRunActionSuccess {
  success: true;
  runId: string;
}

type StartRunActionResult = StartRunActionSuccess | ActionError;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseFormDataModelIds(formData: FormData): string[] {
  const raw = formData.get("modelTargetIds");
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return parsed as string[];
    }
    return [];
  } catch {
    return [];
  }
}

function parseFormDataVariableOverrides(
  formData: FormData
): Record<string, string> {
  const raw = formData.get("variableOverrides");
  if (typeof raw !== "string" || !raw.trim()) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(
        parsed as Record<string, unknown>
      )) {
        if (typeof value === "string") {
          result[key] = value;
        }
      }
      return result;
    }
    return {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// estimateRunAction
// ---------------------------------------------------------------------------

export async function estimateRunAction(
  surveyId: string,
  formData: FormData
): Promise<EstimateActionResult> {
  const session = await requireSession();
  await requireSurveyAccess(session.userId, surveyId, "VIEW");

  const modelTargetIds = parseFormDataModelIds(formData);
  const variableOverrides = parseFormDataVariableOverrides(formData);

  const parsed = estimateRunSchema.safeParse({
    modelTargetIds,
    variableOverrides:
      Object.keys(variableOverrides).length > 0
        ? variableOverrides
        : undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
    };
  }

  try {
    const estimate = await estimateRun({
      surveyId,
      modelTargetIds: parsed.data.modelTargetIds,
    });

    return { success: true, estimate };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to estimate run",
    };
  }
}

// ---------------------------------------------------------------------------
// startRunAction
// ---------------------------------------------------------------------------

export async function startRunAction(
  surveyId: string,
  formData: FormData
): Promise<StartRunActionResult> {
  const session = await requireSession();
  await requireSurveyAccess(session.userId, surveyId, "EDIT");

  const modelTargetIds = parseFormDataModelIds(formData);
  const variableOverrides = parseFormDataVariableOverrides(formData);

  const parsed = estimateRunSchema.safeParse({
    modelTargetIds,
    variableOverrides:
      Object.keys(variableOverrides).length > 0
        ? variableOverrides
        : undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
    };
  }

  // 1. Get estimate
  const estimate = await estimateRun({
    surveyId,
    modelTargetIds: parsed.data.modelTargetIds,
  });

  // 2. Check limits
  const maxTokens = getMaxTokensPerRun();
  const maxCostUsd = getMaxCostPerRunUsd();

  if (estimate.estimatedTotalTokens > maxTokens) {
    return {
      success: false,
      error: `Estimated tokens (${estimate.estimatedTotalTokens.toLocaleString()}) exceed the limit of ${maxTokens.toLocaleString()}`,
    };
  }

  if (estimate.estimatedCostUsd > maxCostUsd) {
    return {
      success: false,
      error: `Estimated cost ($${estimate.estimatedCostUsd.toFixed(2)}) exceeds the limit of $${maxCostUsd.toFixed(2)}`,
    };
  }

  // 3. Create SurveyRun with DRAFT status
  const run = await prisma.surveyRun.create({
    data: {
      surveyId,
      createdById: session.userId,
      status: "DRAFT",
      settingsJson: {
        modelTargetIds: parsed.data.modelTargetIds,
        variableOverrides: variableOverrides,
      },
      limitsJson: {
        maxTokensPerRun: maxTokens,
        maxCostPerRunUsd: maxCostUsd,
      },
      estimatedJson: estimate as unknown as Prisma.InputJsonValue,
    },
  });

  // 4. Create RunModel rows
  await prisma.runModel.createMany({
    data: parsed.data.modelTargetIds.map((modelTargetId) => ({
      runId: run.id,
      modelTargetId,
    })),
  });

  // 5. Allocate jobs
  const allocation = await allocateJobs({
    runId: run.id,
    surveyId,
    modelTargetIds: parsed.data.modelTargetIds,
    variableOverrides:
      Object.keys(variableOverrides).length > 0
        ? variableOverrides
        : undefined,
  });

  // 6. Create all Job rows in the database
  const createdJobs = await prisma.$transaction(
    allocation.jobs.map((job) =>
      prisma.job.create({
        data: {
          runId: run.id,
          modelTargetId: job.modelTargetId,
          questionId: job.questionId,
          threadKey: job.threadKey,
          type: job.type,
          status: "PENDING",
          idempotencyKey: job.idempotencyKey,
          payloadJson: job.payloadJson as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          idempotencyKey: true,
        },
      })
    )
  );

  // 7. Build idempotency key -> job ID mapping
  const idempotencyKeyToJobId = new Map<string, string>();
  for (const createdJob of createdJobs) {
    idempotencyKeyToJobId.set(createdJob.idempotencyKey, createdJob.id);
  }

  // 8. Update run status to QUEUED
  await prisma.surveyRun.update({
    where: { id: run.id },
    data: {
      status: "QUEUED",
      startedAt: new Date(),
    },
  });

  // 9. Signal queue (no-op — jobs already PENDING in DB, worker polls)
  await enqueueRunJobsWithIds(run.id, allocation.jobs, idempotencyKeyToJobId);

  // 10. Create audit event
  await createAuditEvent({
    actorUserId: session.userId,
    action: RUN_STARTED,
    targetType: "SurveyRun",
    targetId: run.id,
    runTargetId: run.id,
    meta: {
      surveyId,
      totalJobs: allocation.totalJobs,
      estimatedCostUsd: estimate.estimatedCostUsd,
    },
  });

  revalidatePath(`/app/surveys/${surveyId}`);

  // 11. Redirect to run detail page
  redirect(`/app/runs/${run.id}`);
}
