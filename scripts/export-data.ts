/**
 * Export all surveys and their run data to a JSON file.
 *
 * Usage (run on LOCAL machine):
 *   pnpm export-data
 *   # or: tsx scripts/export-data.ts
 *
 * Produces: export-YYYY-MM-DD.json in the project root.
 * Transfer that file to the production server, then run import-data.ts there.
 *
 * What is exported:
 *   Survey, Question, Variable, SurveyShare
 *   SurveyRun (terminal: COMPLETED / FAILED / CANCELLED only)
 *   RunModel, LlmResponse, AnalysisResult, ConversationThread
 *   RunModelMetric, RunQuestionAgreement, RunQuestionTruth, RunQuestionReferee
 *
 * What is NOT exported (recreated or irrelevant on production):
 *   Job (ephemeral queue entries)
 *   AuditEvent (audit log)
 *   User / ModelTarget (must already exist on production)
 *
 * User and ModelTarget FKs are replaced with emails / (provider, modelName)
 * pairs in the export so the import script can remap them to production IDs.
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Fetching survey data...");

  const surveys = await prisma.survey.findMany({
    where: { deletedAt: null },
    include: {
      owner: { select: { email: true } },
      questions: { orderBy: { order: "asc" } },
      variables: { orderBy: { createdAt: "asc" } },
      shares: { include: { user: { select: { email: true } } } },
      runs: {
        where: { status: { in: ["COMPLETED", "FAILED", "CANCELLED"] } },
        orderBy: { createdAt: "asc" },
        include: {
          createdBy: { select: { email: true } },
          models: {
            include: { modelTarget: { select: { provider: true, modelName: true } } },
          },
          responses: {
            include: {
              modelTarget: { select: { provider: true, modelName: true } },
              verifiedBy: { select: { email: true } },
              analysis: true,
            },
          },
          modelMetrics: {
            include: { modelTarget: { select: { provider: true, modelName: true } } },
          },
          questionAgreements: true,
          questionTruths: true,
          questionReferees: true,
          threads: {
            include: { modelTarget: { select: { provider: true, modelName: true } } },
          },
        },
      },
    },
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    surveys: surveys.map((s) => ({
      id: s.id,
      ownerEmail: s.owner.email,
      title: s.title,
      description: s.description,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      questions: s.questions.map((q) => ({
        id: q.id,
        surveyId: q.surveyId,
        order: q.order,
        title: q.title,
        promptTemplate: q.promptTemplate,
        mode: q.mode,
        threadKey: q.threadKey,
        type: q.type,
        configJson: q.configJson,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
      })),
      variables: s.variables.map((v) => ({
        id: v.id,
        surveyId: v.surveyId,
        key: v.key,
        label: v.label,
        defaultValue: v.defaultValue,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
      shares: s.shares.map((sh) => ({
        id: sh.id,
        surveyId: sh.surveyId,
        userEmail: sh.user.email,
        role: sh.role,
        createdAt: sh.createdAt.toISOString(),
      })),
      runs: s.runs.map((r) => ({
        id: r.id,
        surveyId: r.surveyId,
        createdByEmail: r.createdBy.email,
        status: r.status,
        settingsJson: r.settingsJson,
        limitsJson: r.limitsJson,
        estimatedJson: r.estimatedJson,
        recommendationJson: r.recommendationJson,
        startedAt: r.startedAt?.toISOString() ?? null,
        completedAt: r.completedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        models: r.models.map((m) => ({
          id: m.id,
          runId: m.runId,
          provider: m.modelTarget.provider,
          modelName: m.modelTarget.modelName,
          createdAt: m.createdAt.toISOString(),
        })),
        responses: r.responses.map((res) => ({
          id: res.id,
          runId: res.runId,
          questionId: res.questionId,
          provider: res.modelTarget.provider,
          modelName: res.modelTarget.modelName,
          threadKey: res.threadKey,
          rawText: res.rawText,
          parsedJson: res.parsedJson,
          citationsJson: res.citationsJson,
          usageJson: res.usageJson,
          // Decimal → string to preserve precision in JSON
          costUsd: res.costUsd !== null ? String(res.costUsd) : null,
          latencyMs: res.latencyMs,
          reasoningText: res.reasoningText,
          requestMessagesJson: res.requestMessagesJson,
          confidence: res.confidence,
          verificationStatus: res.verificationStatus,
          verifiedAt: res.verifiedAt?.toISOString() ?? null,
          verifiedByEmail: res.verifiedBy?.email ?? null,
          createdAt: res.createdAt.toISOString(),
          analysis: res.analysis
            ? {
                id: res.analysis.id,
                responseId: res.analysis.responseId,
                sentimentScore: res.analysis.sentimentScore,
                entitiesJson: res.analysis.entitiesJson,
                brandMentionsJson: res.analysis.brandMentionsJson,
                institutionMentionsJson: res.analysis.institutionMentionsJson,
                flagsJson: res.analysis.flagsJson,
                citationAnalysisJson: res.analysis.citationAnalysisJson,
                claimsJson: res.analysis.claimsJson,
                keySentencesJson: res.analysis.keySentencesJson,
                createdAt: res.analysis.createdAt.toISOString(),
              }
            : null,
        })),
        modelMetrics: r.modelMetrics.map((mm) => ({
          id: mm.id,
          runId: mm.runId,
          provider: mm.modelTarget.provider,
          modelName: mm.modelTarget.modelName,
          reliabilityScore: mm.reliabilityScore,
          jsonValidRate: mm.jsonValidRate,
          emptyAnswerRate: mm.emptyAnswerRate,
          shortAnswerRate: mm.shortAnswerRate,
          citationRate: mm.citationRate,
          latencyCv: mm.latencyCv,
          costCv: mm.costCv,
          penaltyBreakdownJson: mm.penaltyBreakdownJson,
          totalResponses: mm.totalResponses,
          calibrationScore: mm.calibrationScore,
          createdAt: mm.createdAt.toISOString(),
        })),
        questionAgreements: r.questionAgreements.map((qa) => ({
          id: qa.id,
          runId: qa.runId,
          questionId: qa.questionId,
          agreementPercent: qa.agreementPercent,
          outlierModelsJson: qa.outlierModelsJson,
          humanReviewFlag: qa.humanReviewFlag,
          clusterDetailsJson: qa.clusterDetailsJson,
          overconfidentModelsJson: qa.overconfidentModelsJson,
          factComparisonJson: qa.factComparisonJson,
          factConfidenceLevel: qa.factConfidenceLevel,
          factConfidenceScore: qa.factConfidenceScore,
          factConfidenceSignals: qa.factConfidenceSignals,
          createdAt: qa.createdAt.toISOString(),
        })),
        questionTruths: r.questionTruths.map((qt) => ({
          id: qt.id,
          runId: qt.runId,
          questionId: qt.questionId,
          truthScore: qt.truthScore,
          truthLabel: qt.truthLabel,
          consensusPercent: qt.consensusPercent,
          citationRate: qt.citationRate,
          numericDisagreementsJson: qt.numericDisagreementsJson,
          claimClustersJson: qt.claimClustersJson,
          breakdownJson: qt.breakdownJson,
          createdAt: qt.createdAt.toISOString(),
        })),
        questionReferees: r.questionReferees.map((qr) => ({
          id: qr.id,
          runId: qr.runId,
          questionId: qr.questionId,
          refereeModelKey: qr.refereeModelKey,
          summary: qr.summary,
          disagreementsJson: qr.disagreementsJson,
          verifyChecklistJson: qr.verifyChecklistJson,
          recommendedAnswerModelKey: qr.recommendedAnswerModelKey,
          confidence: qr.confidence,
          rawJson: qr.rawJson,
          createdAt: qr.createdAt.toISOString(),
        })),
        threads: r.threads.map((t) => ({
          id: t.id,
          runId: t.runId,
          provider: t.modelTarget.provider,
          modelName: t.modelTarget.modelName,
          threadKey: t.threadKey,
          messagesJson: t.messagesJson,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
      })),
    })),
  };

  const filename = `export-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(filename, JSON.stringify(exportData, null, 2));

  const totalRuns = exportData.surveys.reduce((n, s) => n + s.runs.length, 0);
  const totalResponses = exportData.surveys.reduce(
    (n, s) => n + s.runs.reduce((rn, r) => rn + r.responses.length, 0),
    0,
  );

  console.log(`\n✓ Exported:`);
  console.log(`    ${exportData.surveys.length} surveys`);
  console.log(`    ${totalRuns} runs`);
  console.log(`    ${totalResponses} responses`);
  console.log(`    → ${filename}`);
  console.log(`\nTransfer this file to production and run:`);
  console.log(`    pnpm import-data ${filename}`);
}

main()
  .catch((err) => {
    console.error("\n✗ Export failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
