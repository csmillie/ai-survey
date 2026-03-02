/**
 * Import survey and run data on the PRODUCTION server from an export file.
 *
 * Usage (run on PRODUCTION machine):
 *   pnpm import-data export-YYYY-MM-DD.json
 *   # or: tsx scripts/import-data.ts export-YYYY-MM-DD.json
 *
 * ⚠  WARNING: This DELETES ALL existing surveys and runs on this server
 *    before importing. There is no undo. Take a database backup first.
 *
 * Prerequisites on production:
 *   - All users referenced in the export must exist (matched by email).
 *     If a user is missing, their resources fall back to the admin account.
 *     Shares for missing users are skipped entirely.
 *   - ModelTarget rows must exist and match by (provider, modelName).
 *     Responses/metrics for missing model targets are skipped with a warning.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import type {
  QuestionMode,
  QuestionType,
  ShareRole,
  RunStatus,
  VerificationStatus,
} from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Export shape (mirrors export-data.ts output)
// ---------------------------------------------------------------------------

interface ExportedAnalysis {
  id: string;
  responseId: string;
  sentimentScore: number | null;
  entitiesJson: Prisma.JsonValue;
  brandMentionsJson: Prisma.JsonValue;
  institutionMentionsJson: Prisma.JsonValue;
  flagsJson: Prisma.JsonValue;
  citationAnalysisJson: Prisma.JsonValue;
  claimsJson: Prisma.JsonValue;
  keySentencesJson: Prisma.JsonValue;
  createdAt: string;
}

interface ExportedResponse {
  id: string;
  runId: string;
  questionId: string;
  provider: string;
  modelName: string;
  threadKey: string;
  rawText: string;
  parsedJson: Prisma.JsonValue;
  citationsJson: Prisma.JsonValue;
  usageJson: Prisma.JsonValue;
  costUsd: string | null;
  latencyMs: number | null;
  reasoningText: string | null;
  requestMessagesJson: Prisma.JsonValue;
  confidence: number | null;
  verificationStatus: string;
  verifiedAt: string | null;
  verifiedByEmail: string | null;
  createdAt: string;
  analysis: ExportedAnalysis | null;
}

interface ExportedRun {
  id: string;
  surveyId: string;
  createdByEmail: string;
  status: string;
  settingsJson: Prisma.JsonValue;
  limitsJson: Prisma.JsonValue;
  estimatedJson: Prisma.JsonValue;
  recommendationJson: Prisma.JsonValue;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  models: { id: string; runId: string; provider: string; modelName: string; createdAt: string }[];
  responses: ExportedResponse[];
  modelMetrics: {
    id: string; runId: string; provider: string; modelName: string;
    reliabilityScore: number; jsonValidRate: number; emptyAnswerRate: number;
    shortAnswerRate: number; citationRate: number; latencyCv: number; costCv: number;
    penaltyBreakdownJson: Prisma.JsonValue; totalResponses: number;
    calibrationScore: number | null; createdAt: string;
  }[];
  questionAgreements: {
    id: string; runId: string; questionId: string; agreementPercent: number;
    outlierModelsJson: Prisma.JsonValue; humanReviewFlag: boolean;
    clusterDetailsJson: Prisma.JsonValue; overconfidentModelsJson: Prisma.JsonValue;
    factComparisonJson: Prisma.JsonValue; factConfidenceLevel: string | null;
    factConfidenceScore: number | null; factConfidenceSignals: Prisma.JsonValue;
    createdAt: string;
  }[];
  questionTruths: {
    id: string; runId: string; questionId: string; truthScore: number; truthLabel: string;
    consensusPercent: number; citationRate: number; numericDisagreementsJson: Prisma.JsonValue;
    claimClustersJson: Prisma.JsonValue; breakdownJson: Prisma.JsonValue; createdAt: string;
  }[];
  questionReferees: {
    id: string; runId: string; questionId: string; refereeModelKey: string; summary: string;
    disagreementsJson: Prisma.JsonValue; verifyChecklistJson: Prisma.JsonValue;
    recommendedAnswerModelKey: string | null; confidence: number;
    rawJson: Prisma.JsonValue; createdAt: string;
  }[];
  threads: {
    id: string; runId: string; provider: string; modelName: string;
    threadKey: string; messagesJson: Prisma.JsonValue; createdAt: string; updatedAt: string;
  }[];
}

interface ExportData {
  exportedAt: string;
  surveys: {
    id: string;
    ownerEmail: string;
    title: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
    questions: {
      id: string; surveyId: string; order: number; title: string; promptTemplate: string;
      mode: string; threadKey: string | null; type: string; configJson: Prisma.JsonValue;
      createdAt: string; updatedAt: string;
    }[];
    variables: {
      id: string; surveyId: string; key: string; label: string | null;
      defaultValue: string | null; createdAt: string; updatedAt: string;
    }[];
    shares: {
      id: string; surveyId: string; userEmail: string; role: string; createdAt: string;
    }[];
    runs: ExportedRun[];
  }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50;

async function insertInBatches<T>(
  items: T[],
  insert: (batch: T[]) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    await insert(items.slice(i, i + BATCH_SIZE));
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const filename = process.argv[2];
  if (!filename) {
    console.error("Usage: tsx scripts/import-data.ts <export-file.json>");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(filename, "utf-8")) as ExportData;
  console.log(`Loading export from ${data.exportedAt}`);
  console.log(`  ${data.surveys.length} surveys to import\n`);

  // -------------------------------------------------------------------------
  // 1. Build lookup maps for foreign key remapping
  // -------------------------------------------------------------------------

  const allUsers = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  const userByEmail = new Map(allUsers.map((u) => [u.email, u.id]));

  const adminUser = allUsers.find((u) => u.role === "ADMIN");
  if (!adminUser) {
    console.error("ERROR: No ADMIN user found on this server. Cannot import.");
    process.exit(1);
  }
  console.log(`Fallback user for missing accounts: ${adminUser.email}`);

  const allModelTargets = await prisma.modelTarget.findMany({
    select: { id: true, provider: true, modelName: true },
  });
  const modelTargetByKey = new Map(
    allModelTargets.map((mt) => [`${mt.provider}:${mt.modelName}`, mt.id]),
  );
  console.log(`Found ${allModelTargets.length} model targets on this server\n`);

  function resolveUser(email: string, context: string): string {
    const id = userByEmail.get(email);
    if (!id) {
      console.warn(`  ⚠ User "${email}" not found (${context}) — using admin fallback`);
      return adminUser!.id;
    }
    return id;
  }

  function resolveModelTarget(provider: string, modelName: string): string | null {
    return modelTargetByKey.get(`${provider}:${modelName}`) ?? null;
  }

  // -------------------------------------------------------------------------
  // 2. Delete all existing surveys (CASCADE removes all child records)
  // -------------------------------------------------------------------------

  console.log("⚠  Deleting all existing surveys and run data...");
  const deleted = await prisma.survey.deleteMany({});
  console.log(`✓  Deleted ${deleted.count} existing survey(s)\n`);

  // -------------------------------------------------------------------------
  // 3. Import each survey and all its children
  // -------------------------------------------------------------------------

  let totalRuns = 0;
  let totalResponses = 0;
  let warnings = 0;

  for (const survey of data.surveys) {
    process.stdout.write(`Importing "${survey.title}"...`);

    const ownerId = resolveUser(survey.ownerEmail, `survey owner`);

    await prisma.survey.create({
      data: {
        id: survey.id,
        ownerId,
        title: survey.title,
        description: survey.description,
        createdAt: new Date(survey.createdAt),
        updatedAt: new Date(survey.updatedAt),
      },
    });

    // Questions
    if (survey.questions.length > 0) {
      await prisma.question.createMany({
        data: survey.questions.map((q) => ({
          id: q.id,
          surveyId: q.surveyId,
          order: q.order,
          title: q.title,
          promptTemplate: q.promptTemplate,
          mode: q.mode as QuestionMode,
          threadKey: q.threadKey,
          type: q.type as QuestionType,
          configJson: q.configJson ?? Prisma.JsonNull,
          createdAt: new Date(q.createdAt),
          updatedAt: new Date(q.updatedAt),
        })),
      });
    }

    // Variables
    if (survey.variables.length > 0) {
      await prisma.variable.createMany({
        data: survey.variables.map((v) => ({
          id: v.id,
          surveyId: v.surveyId,
          key: v.key,
          label: v.label,
          defaultValue: v.defaultValue,
          createdAt: new Date(v.createdAt),
          updatedAt: new Date(v.updatedAt),
        })),
      });
    }

    // Shares — skip if user not found (don't fall back for shares)
    for (const share of survey.shares) {
      const userId = userByEmail.get(share.userEmail);
      if (!userId) {
        console.warn(`\n  ⚠ Skipping share for "${share.userEmail}" (user not on this server)`);
        warnings++;
        continue;
      }
      await prisma.surveyShare.create({
        data: {
          id: share.id,
          surveyId: share.surveyId,
          userId,
          role: share.role as ShareRole,
          createdAt: new Date(share.createdAt),
        },
      });
    }

    // Runs
    for (const run of survey.runs) {
      const createdById = resolveUser(run.createdByEmail, `run creator`);

      await prisma.surveyRun.create({
        data: {
          id: run.id,
          surveyId: run.surveyId,
          createdById,
          status: run.status as RunStatus,
          settingsJson: run.settingsJson as Prisma.InputJsonValue,
          limitsJson: run.limitsJson as Prisma.InputJsonValue,
          estimatedJson: (run.estimatedJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          recommendationJson: (run.recommendationJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          startedAt: run.startedAt ? new Date(run.startedAt) : null,
          completedAt: run.completedAt ? new Date(run.completedAt) : null,
          createdAt: new Date(run.createdAt),
          updatedAt: new Date(run.updatedAt),
        },
      });

      // RunModels
      const runModelData = run.models.flatMap((m) => {
        const modelTargetId = resolveModelTarget(m.provider, m.modelName);
        if (!modelTargetId) {
          console.warn(`\n  ⚠ ModelTarget ${m.provider}:${m.modelName} not found — skipping RunModel`);
          warnings++;
          return [];
        }
        return [{ id: m.id, runId: m.runId, modelTargetId, createdAt: new Date(m.createdAt) }];
      });
      if (runModelData.length > 0) {
        await prisma.runModel.createMany({ data: runModelData });
      }

      // LlmResponses
      const responseIdSet = new Set<string>();
      await insertInBatches(run.responses, async (batch) => {
        const responseData = batch.flatMap((res) => {
          const modelTargetId = resolveModelTarget(res.provider, res.modelName);
          if (!modelTargetId) {
            console.warn(`\n  ⚠ ModelTarget ${res.provider}:${res.modelName} not found — skipping response`);
            warnings++;
            return [];
          }
          const verifiedByUserId = res.verifiedByEmail
            ? (userByEmail.get(res.verifiedByEmail) ?? null)
            : null;
          responseIdSet.add(res.id);
          return [{
            id: res.id,
            runId: res.runId,
            modelTargetId,
            questionId: res.questionId,
            threadKey: res.threadKey,
            rawText: res.rawText,
            parsedJson: (res.parsedJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            citationsJson: (res.citationsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            usageJson: (res.usageJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            costUsd: res.costUsd,
            latencyMs: res.latencyMs,
            reasoningText: res.reasoningText,
            requestMessagesJson: (res.requestMessagesJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            confidence: res.confidence,
            verificationStatus: res.verificationStatus as VerificationStatus,
            verifiedAt: res.verifiedAt ? new Date(res.verifiedAt) : null,
            verifiedByUserId,
            createdAt: new Date(res.createdAt),
          }];
        });
        if (responseData.length > 0) {
          await prisma.llmResponse.createMany({ data: responseData });
        }
      });
      totalResponses += run.responses.length;

      // AnalysisResults (only for responses that were successfully imported)
      const analysisData = run.responses
        .filter((r) => r.analysis !== null && responseIdSet.has(r.id))
        .map((r) => {
          const a = r.analysis!;
          return {
            id: a.id,
            responseId: a.responseId,
            sentimentScore: a.sentimentScore,
            entitiesJson: (a.entitiesJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            brandMentionsJson: (a.brandMentionsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            institutionMentionsJson: (a.institutionMentionsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            flagsJson: (a.flagsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            citationAnalysisJson: (a.citationAnalysisJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            claimsJson: (a.claimsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            keySentencesJson: (a.keySentencesJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            createdAt: new Date(a.createdAt),
          };
        });
      if (analysisData.length > 0) {
        await insertInBatches(analysisData, (batch) =>
          prisma.analysisResult.createMany({ data: batch }).then(() => undefined),
        );
      }

      // ConversationThreads
      const threadData = run.threads.flatMap((t) => {
        const modelTargetId = resolveModelTarget(t.provider, t.modelName);
        if (!modelTargetId) {
          warnings++;
          return [];
        }
        return [{
          id: t.id,
          runId: t.runId,
          modelTargetId,
          threadKey: t.threadKey,
          messagesJson: t.messagesJson as Prisma.InputJsonValue,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        }];
      });
      if (threadData.length > 0) {
        await prisma.conversationThread.createMany({ data: threadData });
      }

      // RunModelMetrics
      const metricData = run.modelMetrics.flatMap((mm) => {
        const modelTargetId = resolveModelTarget(mm.provider, mm.modelName);
        if (!modelTargetId) {
          warnings++;
          return [];
        }
        return [{
          id: mm.id,
          runId: mm.runId,
          modelTargetId,
          reliabilityScore: mm.reliabilityScore,
          jsonValidRate: mm.jsonValidRate,
          emptyAnswerRate: mm.emptyAnswerRate,
          shortAnswerRate: mm.shortAnswerRate,
          citationRate: mm.citationRate,
          latencyCv: mm.latencyCv,
          costCv: mm.costCv,
          penaltyBreakdownJson: mm.penaltyBreakdownJson as Prisma.InputJsonValue,
          totalResponses: mm.totalResponses,
          calibrationScore: mm.calibrationScore,
          createdAt: new Date(mm.createdAt),
        }];
      });
      if (metricData.length > 0) {
        await prisma.runModelMetric.createMany({ data: metricData });
      }

      // RunQuestionAgreements
      if (run.questionAgreements.length > 0) {
        await prisma.runQuestionAgreement.createMany({
          data: run.questionAgreements.map((qa) => ({
            id: qa.id,
            runId: qa.runId,
            questionId: qa.questionId,
            agreementPercent: qa.agreementPercent,
            outlierModelsJson: qa.outlierModelsJson as Prisma.InputJsonValue,
            humanReviewFlag: qa.humanReviewFlag,
            clusterDetailsJson: (qa.clusterDetailsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            overconfidentModelsJson: (qa.overconfidentModelsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            factComparisonJson: (qa.factComparisonJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            factConfidenceLevel: qa.factConfidenceLevel,
            factConfidenceScore: qa.factConfidenceScore,
            factConfidenceSignals: (qa.factConfidenceSignals ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            createdAt: new Date(qa.createdAt),
          })),
        });
      }

      // RunQuestionTruths
      if (run.questionTruths.length > 0) {
        await prisma.runQuestionTruth.createMany({
          data: run.questionTruths.map((qt) => ({
            id: qt.id,
            runId: qt.runId,
            questionId: qt.questionId,
            truthScore: qt.truthScore,
            truthLabel: qt.truthLabel,
            consensusPercent: qt.consensusPercent,
            citationRate: qt.citationRate,
            numericDisagreementsJson: qt.numericDisagreementsJson as Prisma.InputJsonValue,
            claimClustersJson: qt.claimClustersJson as Prisma.InputJsonValue,
            breakdownJson: qt.breakdownJson as Prisma.InputJsonValue,
            createdAt: new Date(qt.createdAt),
          })),
        });
      }

      // RunQuestionReferees
      if (run.questionReferees.length > 0) {
        await prisma.runQuestionReferee.createMany({
          data: run.questionReferees.map((qr) => ({
            id: qr.id,
            runId: qr.runId,
            questionId: qr.questionId,
            refereeModelKey: qr.refereeModelKey,
            summary: qr.summary,
            disagreementsJson: qr.disagreementsJson as Prisma.InputJsonValue,
            verifyChecklistJson: qr.verifyChecklistJson as Prisma.InputJsonValue,
            recommendedAnswerModelKey: qr.recommendedAnswerModelKey,
            confidence: qr.confidence,
            rawJson: qr.rawJson as Prisma.InputJsonValue,
            createdAt: new Date(qr.createdAt),
          })),
        });
      }

      totalRuns++;
    }

    console.log(` ✓ (${survey.runs.length} runs, ${survey.runs.reduce((n, r) => n + r.responses.length, 0)} responses)`);
  }

  // -------------------------------------------------------------------------
  // 4. Summary
  // -------------------------------------------------------------------------

  console.log(`\n✓ Import complete:`);
  console.log(`    ${data.surveys.length} surveys`);
  console.log(`    ${totalRuns} runs`);
  console.log(`    ${totalResponses} responses`);
  if (warnings > 0) {
    console.log(`    ⚠ ${warnings} warning(s) — check output above for skipped records`);
  }
}

main()
  .catch((err) => {
    console.error("\n✗ Import failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
