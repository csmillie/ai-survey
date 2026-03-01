import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ComputeMetricsPayload } from "@/lib/queue";
import {
  computeReliabilityScore,
  type ResponseMetrics,
} from "@/lib/analysis/reliability";
import {
  computeOpenEndedAgreement,
  computeRankedAgreement,
  type OpenEndedResponse,
  type RankedResponse,
} from "@/lib/analysis/agreement";
import {
  computeRecommendation,
  type ModelScore,
  type QuestionReview,
} from "@/lib/analysis/recommendation";
import { rankedConfigSchema } from "@/lib/schemas";

interface ComputeMetricsHandlerPayload extends ComputeMetricsPayload {
  jobId: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedOpenEnded {
  answerText?: string;
}

interface ParsedRanked {
  score?: number;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleComputeMetrics(
  payload: ComputeMetricsHandlerPayload
): Promise<void> {
  const { runId, jobId } = payload;

  try {
    // 1. Check all ANALYZE_RESPONSE jobs are done
    const pendingAnalyzeJobs = await prisma.job.count({
      where: {
        runId,
        type: "ANALYZE_RESPONSE",
        status: { in: ["PENDING", "RUNNING", "RETRYING"] },
      },
    });

    if (pendingAnalyzeJobs > 0) {
      // Check how many times we've retried — fail after 60 cycles to avoid infinite loops
      // (e.g. if analysis jobs are stuck in RUNNING due to worker crash)
      const metricsJob = await prisma.job.findUnique({
        where: { id: jobId },
        select: { attempt: true },
      });
      const attempt = metricsJob?.attempt ?? 0;

      if (attempt >= 60) {
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            lastError: `Timed out waiting for ${pendingAnalyzeJobs} ANALYZE_RESPONSE jobs after ${attempt} attempts`,
          },
        });
        return;
      }

      // Set back to PENDING so it retries on next poll cycle
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "PENDING", startedAt: null, attempt: attempt + 1 },
      });
      return;
    }

    // 2. Load all responses with analysis, modelTarget, question
    const responses = await prisma.llmResponse.findMany({
      where: { runId },
      select: {
        id: true,
        modelTargetId: true,
        questionId: true,
        rawText: true,
        parsedJson: true,
        reasoningText: true,
        citationsJson: true,
        costUsd: true,
        latencyMs: true,
        modelTarget: {
          select: { id: true, modelName: true, provider: true },
        },
        question: {
          select: { id: true, title: true, type: true, configJson: true },
        },
        analysis: {
          select: { flagsJson: true },
        },
      },
    });

    // 3. Group by model → compute reliability scores
    const byModel = new Map<
      string,
      {
        modelName: string;
        responses: typeof responses;
      }
    >();

    for (const resp of responses) {
      const existing = byModel.get(resp.modelTargetId);
      if (existing) {
        existing.responses.push(resp);
      } else {
        byModel.set(resp.modelTargetId, {
          modelName: resp.modelTarget.modelName,
          responses: [resp],
        });
      }
    }

    const modelScores: ModelScore[] = [];

    for (const [modelTargetId, data] of byModel) {
      const metrics: ResponseMetrics[] = data.responses.map((r) => {
        const flags = (r.analysis?.flagsJson as string[] | null) ?? [];
        const parsed = r.parsedJson as Record<string, unknown> | null;
        const citations = r.citationsJson as unknown[] | null;

        return {
          hasValidJson: parsed !== null && !flags.includes("invalid_json"),
          isEmpty: flags.includes("empty_answer") || !r.rawText.trim(),
          isShort: flags.includes("short_answer"),
          hasCitations:
            (citations !== null && Array.isArray(citations) && citations.length > 0) ||
            r.question.type === "RANKED",
          latencyMs: r.latencyMs ?? 0,
          costUsd: r.costUsd ? Number(r.costUsd) : 0,
        };
      });

      const result = computeReliabilityScore(metrics);

      await prisma.runModelMetric.upsert({
        where: {
          runId_modelTargetId: { runId, modelTargetId },
        },
        create: {
          runId,
          modelTargetId,
          reliabilityScore: result.score,
          jsonValidRate: result.jsonValidRate,
          emptyAnswerRate: result.emptyAnswerRate,
          shortAnswerRate: result.shortAnswerRate,
          citationRate: result.citationRate,
          latencyCv: result.latencyCv,
          costCv: result.costCv,
          penaltyBreakdownJson:
            result.penaltyBreakdown as unknown as Prisma.InputJsonValue,
          totalResponses: result.totalResponses,
        },
        update: {
          reliabilityScore: result.score,
          jsonValidRate: result.jsonValidRate,
          emptyAnswerRate: result.emptyAnswerRate,
          shortAnswerRate: result.shortAnswerRate,
          citationRate: result.citationRate,
          latencyCv: result.latencyCv,
          costCv: result.costCv,
          penaltyBreakdownJson:
            result.penaltyBreakdown as unknown as Prisma.InputJsonValue,
          totalResponses: result.totalResponses,
        },
      });

      const totalCost = data.responses.reduce(
        (sum, r) => sum + (r.costUsd ? Number(r.costUsd) : 0),
        0
      );

      modelScores.push({
        modelTargetId,
        modelName: data.modelName,
        reliabilityScore: result.score,
        avgCostUsd:
          data.responses.length > 0 ? totalCost / data.responses.length : 0,
      });
    }

    // 4. Group by question → compute agreement
    const byQuestion = new Map<
      string,
      {
        questionTitle: string;
        questionType: string;
        configJson: Prisma.JsonValue;
        responses: typeof responses;
      }
    >();

    for (const resp of responses) {
      const existing = byQuestion.get(resp.questionId);
      if (existing) {
        existing.responses.push(resp);
      } else {
        byQuestion.set(resp.questionId, {
          questionTitle: resp.question.title,
          questionType: resp.question.type,
          configJson: resp.question.configJson,
          responses: [resp],
        });
      }
    }

    const questionReviews: QuestionReview[] = [];

    for (const [questionId, data] of byQuestion) {
      let agreement;

      if (data.questionType === "RANKED") {
        const config = rankedConfigSchema.safeParse(data.configJson);
        const rankedResponses: RankedResponse[] = data.responses
          .map((r) => {
            const parsed = r.parsedJson as unknown as ParsedRanked | null;
            return parsed?.score != null
              ? { modelName: r.modelTarget.modelName, score: parsed.score }
              : null;
          })
          .filter((r): r is RankedResponse => r !== null);

        agreement = computeRankedAgreement(
          rankedResponses,
          config.success ? config.data.scaleMin : 0,
          config.success ? config.data.scaleMax : 10
        );
      } else {
        const openEndedResponses: OpenEndedResponse[] = data.responses.map(
          (r) => {
            const parsed = r.parsedJson as unknown as ParsedOpenEnded | null;
            return {
              modelName: r.modelTarget.modelName,
              text: parsed?.answerText ?? r.rawText,
            };
          }
        );

        agreement = computeOpenEndedAgreement(openEndedResponses);
      }

      await prisma.runQuestionAgreement.upsert({
        where: {
          runId_questionId: { runId, questionId },
        },
        create: {
          runId,
          questionId,
          agreementPercent: agreement.agreementPercent,
          outlierModelsJson:
            agreement.outlierModels as unknown as Prisma.InputJsonValue,
          humanReviewFlag: agreement.humanReviewFlag,
          clusterDetailsJson: agreement.clusterDetails
            ? (agreement.clusterDetails as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
        update: {
          agreementPercent: agreement.agreementPercent,
          outlierModelsJson:
            agreement.outlierModels as unknown as Prisma.InputJsonValue,
          humanReviewFlag: agreement.humanReviewFlag,
          clusterDetailsJson: agreement.clusterDetails
            ? (agreement.clusterDetails as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });

      questionReviews.push({
        questionId,
        humanReviewFlag: agreement.humanReviewFlag,
      });
    }

    // 5. Compute recommendation and update run
    const recommendation = computeRecommendation(modelScores, questionReviews);
    await prisma.surveyRun.update({
      where: { id: runId },
      data: {
        recommendationJson:
          recommendation as unknown as Prisma.InputJsonValue,
      },
    });

    // 6. Mark job as SUCCEEDED
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
      },
    });

    console.log(
      `[compute-metrics] Completed for run ${runId}: ${modelScores.length} models, ${questionReviews.length} questions`
    );
  } catch (err) {
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          lastError: err instanceof Error ? err.message : "Unknown error",
        },
      });
    } catch {
      // Ignore if job update fails
    }
    throw err;
  }
}
