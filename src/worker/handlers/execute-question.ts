import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ExecuteQuestionPayload } from "@/lib/queue";
import { enqueueAnalyzeJob } from "@/lib/queue";
import { getProvider } from "@/providers/registry";
import type { LlmMessage } from "@/providers/types";
import { JSON_ENFORCEMENT_BLOCK } from "@/providers/types";
import { repairAndParseJson } from "@/lib/json-repair";
import { createAuditEvent, RUN_COMPLETED, RUN_FAILED } from "@/lib/audit";

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
  } = payload;

  try {
    // 1. Load ModelTarget
    const modelTarget = await prisma.modelTarget.findUniqueOrThrow({
      where: { id: modelTargetId },
    });

    // 2. Build messages
    const messages: LlmMessage[] = [
      {
        role: "system",
        content:
          "You are a research assistant. Answer questions accurately with citations.",
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
    const userContent = renderedPrompt + JSON_ENFORCEMENT_BLOCK;
    messages.push({ role: "user", content: userContent });

    // 3. Call LLM provider
    const provider = getProvider(modelTarget.provider);
    const response = await provider.sendRequest({
      model: modelTarget.modelName,
      messages,
    });

    // 4. Parse response
    const { parsed, error: parseError } = repairAndParseJson(response.text);
    const typedParsed = parsed as ParsedLlmResponse | null;

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
        parsedJson: typedParsed
          ? (typedParsed as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        citationsJson: typedParsed?.citations
          ? (typedParsed.citations as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
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

    // 9. Enqueue ANALYZE_RESPONSE job
    await enqueueAnalyzeJob({
      runId,
      responseId: llmResponse.id,
      modelTargetId,
    });

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

  // Load run to get createdById for audit and to check current status
  const run = await prisma.surveyRun.findUnique({
    where: { id: runId },
    select: { status: true, createdById: true },
  });

  if (!run) return;

  // Only transition if still RUNNING or QUEUED
  if (run.status !== "RUNNING" && run.status !== "QUEUED") return;

  const allFailed = failedJobs === totalJobs;
  const newStatus = allFailed ? "FAILED" : "COMPLETED";
  const now = new Date();

  await prisma.surveyRun.update({
    where: { id: runId },
    data: {
      status: newStatus,
      completedAt: now,
    },
  });

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
