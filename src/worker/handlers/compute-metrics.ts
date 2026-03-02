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
import {
  computeCalibrationScore,
  findOverconfidentModels,
  type CalibrationInput,
} from "@/lib/analysis/calibration";
import {
  rankedConfigSchema,
  flagsJsonSchema,
  parsedRankedSchema,
  parsedOpenEndedSchema,
  claimsJsonSchema,
  citationAnalysisJsonSchema,
  keySentencesJsonSchema,
} from "@/lib/schemas";
import type { AgreementResult } from "@/lib/analysis/agreement";
import {
  compareAcrossModels,
  type ModelFactData,
  type FactCheckResult,
} from "@/lib/analysis/fact-check";
import { computeFactConfidence } from "@/lib/analysis/fact-confidence";

interface ComputeMetricsHandlerPayload extends ComputeMetricsPayload {
  jobId: string;
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
      // (worker increments `attempt` on each claim, so no need to increment here)
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "PENDING", startedAt: null },
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
        confidence: true,
        costUsd: true,
        latencyMs: true,
        modelTarget: {
          select: { id: true, modelName: true, provider: true },
        },
        question: {
          select: { id: true, title: true, type: true, configJson: true },
        },
        analysis: {
          select: {
            flagsJson: true,
            claimsJson: true,
            citationAnalysisJson: true,
            keySentencesJson: true,
          },
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

    // 3–5. Compute all metrics, then persist atomically in a transaction
    const modelScores: ModelScore[] = [];
    const modelUpserts: Array<{
      modelTargetId: string;
      result: ReturnType<typeof computeReliabilityScore>;
    }> = [];

    for (const [modelTargetId, data] of byModel) {
      const metrics: ResponseMetrics[] = data.responses.map((r) => {
        const flags = flagsJsonSchema.parse(r.analysis?.flagsJson) ?? [];
        const rawParsed: unknown = r.parsedJson;
        const parsed = (rawParsed === null || rawParsed === Prisma.JsonNull)
          ? null
          : rawParsed as Record<string, unknown>;
        const rawCitations: unknown = r.citationsJson;
        const citations = (rawCitations === null || rawCitations === Prisma.JsonNull)
          ? null
          : rawCitations as unknown[];
        const isRanked = r.question.type === "RANKED";

        return {
          hasValidJson: parsed !== null && !flags.includes("invalid_json"),
          isEmpty: flags.includes("empty_answer") || !r.rawText.trim(),
          isShort: flags.includes("short_answer"),
          hasCitations: isRanked
            ? true // RANKED questions don't require citations; exclude from penalty
            : citations !== null && Array.isArray(citations) && citations.length > 0,
          latencyMs: r.latencyMs ?? 0,
          costUsd: r.costUsd ? Number(r.costUsd) : 0,
        };
      });

      const result = computeReliabilityScore(metrics);
      modelUpserts.push({ modelTargetId, result });

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
    const questionUpserts: Array<{
      questionId: string;
      agreement: ReturnType<typeof computeOpenEndedAgreement>;
    }> = [];

    for (const [questionId, data] of byQuestion) {
      let agreement: AgreementResult;

      if (data.questionType === "RANKED") {
        const config = rankedConfigSchema.safeParse(data.configJson);
        const rankedResponses: RankedResponse[] = data.responses
          .map((r) => {
            const parsed = parsedRankedSchema.parse(r.parsedJson);
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
            const parsed = parsedOpenEndedSchema.parse(r.parsedJson);
            return {
              modelName: r.modelTarget.modelName,
              text: parsed?.answerText ?? r.rawText,
            };
          }
        );

        agreement = computeOpenEndedAgreement(openEndedResponses);
      }

      questionUpserts.push({ questionId, agreement });
      questionReviews.push({
        questionId,
        humanReviewFlag: agreement.humanReviewFlag,
      });
    }

    // 4b. Pre-compute resolved confidence per response.
    // Confidence is always stored in the dedicated column by execute-question.
    const confidenceByResponseId = new Map<string, number | null>();
    for (const r of responses) {
      confidenceByResponseId.set(r.id, r.confidence ?? null);
    }

    // 4c. Build agreement lookup for calibration computation
    const agreementByQuestion = new Map<string, number>();
    for (const { questionId, agreement } of questionUpserts) {
      agreementByQuestion.set(questionId, agreement.agreementPercent);
    }

    // 4d. Compute per-model calibration scores
    const calibrationByModel = new Map<string, number | null>();
    for (const [modelTargetId, data] of byModel) {
      const calibrationInputs: CalibrationInput[] = [];
      for (const r of data.responses) {
        const conf = confidenceByResponseId.get(r.id);
        const agr = agreementByQuestion.get(r.questionId);
        if (conf != null && agr != null) {
          calibrationInputs.push({ confidence: conf, agreementPercent: agr });
        }
      }
      if (calibrationInputs.length > 0) {
        const { calibrationScore } = computeCalibrationScore(calibrationInputs);
        calibrationByModel.set(modelTargetId, calibrationScore);
      } else {
        calibrationByModel.set(modelTargetId, null);
      }
    }

    // 4e. Compute per-question overconfident models
    const overconfidentByQuestion = new Map<string, string[]>();
    for (const { questionId, agreement } of questionUpserts) {
      const qData = byQuestion.get(questionId);
      if (!qData) continue;
      const overconfident = findOverconfidentModels(
        qData.responses.map((r) => ({
          modelName: r.modelTarget.modelName,
          confidence: confidenceByResponseId.get(r.id) ?? null,
        })),
        agreement.agreementPercent
      );
      overconfidentByQuestion.set(questionId, overconfident);
    }

    // 4f. Compute per-question fact confidence
    const factConfidenceByQuestion = new Map<
      string,
      { level: string; score: number; signals: string[]; comparison: ReturnType<typeof compareAcrossModels> }
    >();
    for (const { questionId, agreement } of questionUpserts) {
      const qData = byQuestion.get(questionId);
      if (!qData) continue;

      // Build per-model fact-check data for comparison
      const modelFactData: ModelFactData[] = qData.responses
        .map((r) => {
          const claims = claimsJsonSchema.parse(r.analysis?.claimsJson) ?? [];
          const citationAnalysis = citationAnalysisJsonSchema.parse(
            r.analysis?.citationAnalysisJson
          ) ?? { totalCitations: 0, hasValidUrls: false, domains: [] };
          const keySentences =
            keySentencesJsonSchema.parse(r.analysis?.keySentencesJson) ?? [];

          const factCheck: FactCheckResult = {
            claims,
            citationAnalysis,
            keySentences,
          };

          return {
            modelName: r.modelTarget.modelName,
            factCheck,
          };
        });

      const comparison = compareAcrossModels(modelFactData);
      const factConfidence = computeFactConfidence({
        agreementPercent: agreement.agreementPercent,
        comparison,
        totalModels: modelFactData.length,
      });

      factConfidenceByQuestion.set(questionId, {
        level: factConfidence.level,
        score: factConfidence.score,
        signals: factConfidence.signals,
        comparison,
      });
    }

    // 5. Compute recommendation
    const recommendation = computeRecommendation(modelScores, questionReviews);

    // 6. Persist all metrics atomically (concurrent upserts within tx)
    await prisma.$transaction(async (tx) => {
      await Promise.all([
        ...modelUpserts.map(({ modelTargetId, result }) =>
          tx.runModelMetric.upsert({
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
              calibrationScore: calibrationByModel.get(modelTargetId) ?? null,
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
              calibrationScore: calibrationByModel.get(modelTargetId) ?? null,
              penaltyBreakdownJson:
                result.penaltyBreakdown as unknown as Prisma.InputJsonValue,
              totalResponses: result.totalResponses,
            },
          })
        ),
        ...questionUpserts.map(({ questionId, agreement }) => {
          const overconfident = overconfidentByQuestion.get(questionId) ?? [];
          const factConf = factConfidenceByQuestion.get(questionId);
          const factConfData = {
            factConfidenceLevel: factConf?.level ?? null,
            factConfidenceScore: factConf?.score ?? null,
            factConfidenceSignals: factConf
              ? (factConf.signals as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            factComparisonJson: factConf
              ? (factConf.comparison as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          };
          return tx.runQuestionAgreement.upsert({
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
              overconfidentModelsJson:
                overconfident as unknown as Prisma.InputJsonValue,
              clusterDetailsJson: agreement.clusterDetails
                ? (agreement.clusterDetails as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull,
              ...factConfData,
            },
            update: {
              agreementPercent: agreement.agreementPercent,
              outlierModelsJson:
                agreement.outlierModels as unknown as Prisma.InputJsonValue,
              humanReviewFlag: agreement.humanReviewFlag,
              overconfidentModelsJson:
                overconfident as unknown as Prisma.InputJsonValue,
              clusterDetailsJson: agreement.clusterDetails
                ? (agreement.clusterDetails as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull,
              ...factConfData,
            },
          });
        }),
        tx.surveyRun.update({
          where: { id: runId },
          data: {
            recommendationJson:
              recommendation as unknown as Prisma.InputJsonValue,
          },
        }),
      ]);
    });

    // 7. Mark job as SUCCEEDED
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
