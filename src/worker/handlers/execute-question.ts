import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ExecuteQuestionPayload } from "@/lib/queue";
import { enqueueAnalyzeJob, enqueueComputeMetricsJob } from "@/lib/queue";
import { getProvider } from "@/providers/registry";
import type { LlmMessage } from "@/providers/types";
import { JSON_ENFORCEMENT_BLOCK } from "@/providers/types";
import { repairAndParseJson } from "@/lib/json-repair";
import { createAuditEvent, RUN_COMPLETED, RUN_FAILED } from "@/lib/audit";
import {
  buildRankedSystemPrompt,
  buildRankedEnforcementBlock,
  clampScore,
} from "@/lib/ranked-prompt";
import { rankedResponseSchema, llmResponseSchema } from "@/lib/schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedLlmResponse {
  answerText: string;
  citations: Array<{ url: string; title?: string; snippet?: string }>;
  notes?: string;
}

interface StoredMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleExecuteQuestion(
  payload: ExecuteQuestionPayload
): Promise<void> {
  const {
    jobId,
    runId,
    modelTargetId,
    questionId,
    threadKey,
    renderedPrompt,
    questionMode,
    questionType,
    questionConfig,
  } = payload;

  try {
    // 1. Load ModelTarget
    const modelTarget = await prisma.modelTarget.findUniqueOrThrow({
      where: { id: modelTargetId },
    });

    // 2. Build messages
    const isRanked = questionType === "RANKED" && !!questionConfig;
    const rankedConfig = isRanked ? questionConfig : null;

    const messages: LlmMessage[] = [
      {
        role: "system",
        content: isRanked
          ? buildRankedSystemPrompt()
          : "You are a research assistant. Answer questions accurately with citations.",
      },
    ];

    // For THREADED mode, prepend existing conversation history
    if (questionMode === "THREADED") {
      const existingThread = await prisma.conversationThread.findUnique({
        where: {
          runId_modelTargetId_threadKey: { runId, modelTargetId, threadKey },
        },
      });

      if (existingThread) {
        const storedMessages = existingThread.messagesJson as unknown as StoredMessage[];
        for (const msg of storedMessages) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Add the user message
    const userContent = isRanked && rankedConfig
      ? renderedPrompt + buildRankedEnforcementBlock({
          scaleMin: rankedConfig.scaleMin,
          scaleMax: rankedConfig.scaleMax,
          includeReasoning: rankedConfig.includeReasoning,
        })
      : renderedPrompt + JSON_ENFORCEMENT_BLOCK;
    messages.push({ role: "user", content: userContent });

    // 3. Call LLM provider
    const provider = getProvider(modelTarget.provider);
    const response = await provider.sendRequest({
      model: modelTarget.modelName,
      messages,
    });

    // 4. Parse response
    const { parsed, error: parseError } = repairAndParseJson(response.text);

    if (parseError) {
      console.warn(
        `[execute-question] JSON error from ${modelTarget.provider}/${modelTarget.modelName} (job ${jobId}): ${parseError}`
      );
    }

    let reasoningText: string | null = null;
    let finalParsed = parsed as Record<string, unknown> | null;
    let confidence: number | null = null;

    if (isRanked && rankedConfig && parsed) {
      const rankedResult = rankedResponseSchema.safeParse(parsed);
      if (rankedResult.success) {
        const clamped = clampScore(
          rankedResult.data.score,
          rankedConfig.scaleMin,
          rankedConfig.scaleMax,
        );
        finalParsed = { score: clamped };
        reasoningText = rankedResult.data.reasoning ?? null;
        confidence = rankedResult.data.confidence != null
          ? Math.round(rankedResult.data.confidence)
          : null;
      } else {
        console.warn(
          `Ranked response parse failed for job ${jobId}: ${rankedResult.error.message}`
        );
        finalParsed = null;
      }
    } else if (parsed) {
      // Open-ended: extract confidence via Zod (validates 0-100 range)
      const openEndedResult = llmResponseSchema.safeParse(parsed);
      confidence = openEndedResult.success && openEndedResult.data.confidence != null
        ? Math.round(openEndedResult.data.confidence)
        : null;
    }

    // 5. Calculate cost
    const inputCost = new Prisma.Decimal(response.usage.inputTokens)
      .mul(modelTarget.inputTokenCostUsd)
      .div(1_000_000);
    const outputCost = new Prisma.Decimal(response.usage.outputTokens)
      .mul(modelTarget.outputTokenCostUsd)
      .div(1_000_000);
    const costUsd = inputCost.add(outputCost);

    // 6. Create LlmResponse record
    const llmResponse = await prisma.llmResponse.create({
      data: {
        runId,
        modelTargetId,
        questionId,
        threadKey,
        rawText: response.text,
        requestMessagesJson: messages as unknown as Prisma.InputJsonValue,
        parsedJson: finalParsed
          ? (finalParsed as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        citationsJson: !isRanked && finalParsed && "citations" in finalParsed
          ? ((finalParsed as unknown as ParsedLlmResponse).citations as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        reasoningText,
        confidence,
        usageJson: response.usage as unknown as Prisma.InputJsonValue,
        costUsd,
        latencyMs: response.latencyMs,
      },
    });

    // 7. For THREADED mode, upsert ConversationThread
    if (questionMode === "THREADED") {
      const existingThread = await prisma.conversationThread.findUnique({
        where: {
          runId_modelTargetId_threadKey: { runId, modelTargetId, threadKey },
        },
      });

      const newUserMsg: StoredMessage = { role: "user", content: userContent };
      const newAssistantMsg: StoredMessage = {
        role: "assistant",
        content: response.text,
      };

      if (existingThread) {
        const existing = existingThread.messagesJson as unknown as StoredMessage[];
        const updated = [...existing, newUserMsg, newAssistantMsg];
        await prisma.conversationThread.update({
          where: { id: existingThread.id },
          data: {
            messagesJson: updated as unknown as Prisma.InputJsonValue,
          },
        });
      } else {
        await prisma.conversationThread.create({
          data: {
            runId,
            modelTargetId,
            threadKey,
            messagesJson: [
              newUserMsg,
              newAssistantMsg,
            ] as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }

    // 8. Mark job as SUCCEEDED
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        lastError: parseError ?? null,
      },
    });

    // 9. Enqueue ANALYZE_RESPONSE job (skip for ranked without reasoning)
    const shouldAnalyze = !isRanked || rankedConfig?.includeReasoning === true;
    if (shouldAnalyze) {
      await enqueueAnalyzeJob({
        runId,
        responseId: llmResponse.id,
        modelTargetId,
      });
    }

    // 10. Check if all EXECUTE_QUESTION jobs for this run are done
    await checkRunCompletion(runId);
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";

    // Mark job as FAILED
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          lastError: errorMessage,
        },
      });
    } catch {
      console.error(
        `Failed to update job ${jobId} status to FAILED:`,
        errorMessage
      );
    }

    // Check if run should be marked FAILED
    try {
      await checkRunCompletion(runId);
    } catch {
      console.error(`Failed to check run completion for run ${runId}`);
    }

    throw err;
  }
}

// ---------------------------------------------------------------------------
// Run completion checker
// ---------------------------------------------------------------------------

async function checkRunCompletion(runId: string): Promise<void> {
  const incompleteJobs = await prisma.job.count({
    where: {
      runId,
      type: "EXECUTE_QUESTION",
      status: { in: ["PENDING", "RUNNING", "RETRYING"] },
    },
  });

  if (incompleteJobs > 0) return;

  // All jobs are finished — determine outcome
  const failedJobs = await prisma.job.count({
    where: {
      runId,
      type: "EXECUTE_QUESTION",
      status: "FAILED",
    },
  });

  const totalJobs = await prisma.job.count({
    where: {
      runId,
      type: "EXECUTE_QUESTION",
    },
  });

  const allFailed = failedJobs === totalJobs;
  const newStatus = allFailed ? "FAILED" : "COMPLETED";
  const now = new Date();

  // Atomic status transition — only one worker wins the race
  const updated = await prisma.surveyRun.updateMany({
    where: { id: runId, status: { in: ["RUNNING", "QUEUED"] } },
    data: {
      status: newStatus,
      completedAt: now,
    },
  });

  // Another worker already transitioned this run
  if (updated.count === 0) return;

  const run = await prisma.surveyRun.findUnique({
    where: { id: runId },
    select: { createdById: true },
  });

  if (!run) return;

  // Enqueue COMPUTE_METRICS before audit event so a createAuditEvent failure
  // can't leave the run marked COMPLETED with no metrics job queued.
  if (newStatus === "COMPLETED") {
    const runModel = await prisma.runModel.findFirst({
      where: { runId },
      select: { modelTargetId: true },
    });
    if (!runModel) {
      console.warn(`[checkRunCompletion] No RunModel found for run ${runId} — skipping COMPUTE_METRICS`);
      return;
    }
    try {
      await enqueueComputeMetricsJob({
        runId,
        modelTargetId: runModel.modelTargetId,
      });
    } catch (err) {
      // P2002 = unique constraint (idempotency key collision) — job already exists, safe to ignore
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // fall through to audit event
      } else {
        throw err;
      }
    }
  }

  await createAuditEvent({
    actorUserId: run.createdById,
    action: newStatus === "COMPLETED" ? RUN_COMPLETED : RUN_FAILED,
    targetType: "SurveyRun",
    targetId: runId,
    runTargetId: runId,
    meta: {
      totalJobs,
      failedJobs,
    },
  });
}
