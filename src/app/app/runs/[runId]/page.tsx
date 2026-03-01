import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canAccessSurvey } from "@/lib/survey-auth";
import {
  rankedConfigSchema,
  penaltyBreakdownSchema,
  recommendationSchema,
  outlierModelsSchema,
} from "@/lib/schemas";
import { RunProgressView } from "./run-progress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunPageProps {
  params: Promise<{ runId: string }>;
}

interface ParsedLlmResponse {
  answerText?: string;
  citations?: Array<{ url: string; title?: string; snippet?: string }>;
  score?: number;
  reasoning?: string;
}

interface AnalysisEntities {
  people: string[];
  places: string[];
  organizations: string[];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RunPage({ params }: RunPageProps) {
  const { runId } = await params;
  const session = await requireSession();

  // Load run with all related data
  const run = await prisma.surveyRun.findUnique({
    where: { id: runId },
    include: {
      survey: {
        select: { id: true, title: true, ownerId: true },
      },
      jobs: {
        where: { type: "EXECUTE_QUESTION" },
        select: { status: true },
      },
      responses: {
        include: {
          question: {
            select: { id: true, title: true, type: true, configJson: true },
          },
          modelTarget: {
            select: { modelName: true, provider: true },
          },
          analysis: true,
        },
        orderBy: [
          { questionId: "asc" },
          { modelTargetId: "asc" },
        ],
      },
    },
  });

  if (!run) {
    notFound();
  }

  // Verify access
  const hasAccess = await canAccessSurvey(
    session.userId,
    run.survey.id,
    "VIEW"
  );
  if (!hasAccess) {
    notFound();
  }

  // Compute job counts
  const totalJobs = run.jobs.length;
  const completedJobs = run.jobs.filter((j) => j.status === "SUCCEEDED").length;
  const failedJobs = run.jobs.filter((j) => j.status === "FAILED").length;

  // Transform responses for the client component
  const responses = run.responses.map((resp) => {
    const parsed = resp.parsedJson as unknown as ParsedLlmResponse | null;

    return {
      id: resp.id,
      questionId: resp.question.id,
      questionTitle: resp.question.title,
      questionType: resp.question.type,
      questionConfig: (() => {
        const result = rankedConfigSchema.safeParse(resp.question.configJson);
        return result.success
          ? { scaleMin: result.data.scaleMin, scaleMax: result.data.scaleMax }
          : null;
      })(),
      modelName: resp.modelTarget.modelName,
      provider: resp.modelTarget.provider,
      answerText: parsed?.answerText ?? (parsed?.score != null ? "" : resp.rawText),
      score: parsed?.score ?? null,
      reasoningText: resp.reasoningText ?? null,
      citations: parsed?.citations ?? [],
      sentimentScore: resp.analysis?.sentimentScore ?? null,
      costUsd: resp.costUsd?.toString() ?? null,
      latencyMs: resp.latencyMs,
      flags: (resp.analysis?.flagsJson as string[] | null) ?? [],
      brandMentions:
        (resp.analysis?.brandMentionsJson as string[] | null) ?? [],
      institutionMentions:
        (resp.analysis?.institutionMentionsJson as string[] | null) ?? [],
      entities:
        (resp.analysis?.entitiesJson as AnalysisEntities | null) ?? null,
    };
  });

  // Total cost
  const totalCostUsd = responses.reduce((sum, r) => {
    return sum + (r.costUsd ? parseFloat(r.costUsd) : 0);
  }, 0);

  // Load ModelTrust metrics (may be empty for older runs)
  const modelMetrics = await prisma.runModelMetric.findMany({
    where: { runId },
    include: {
      modelTarget: {
        select: { modelName: true, provider: true },
      },
    },
    orderBy: { reliabilityScore: "desc" },
  });

  const questionAgreements = await prisma.runQuestionAgreement.findMany({
    where: { runId },
    include: {
      question: {
        select: { title: true },
      },
    },
    orderBy: { agreementPercent: "asc" },
  });

  const modelMetricsData = modelMetrics.flatMap((m) => {
    const breakdown = penaltyBreakdownSchema.safeParse(m.penaltyBreakdownJson);
    if (!breakdown.success) return [];
    return [
      {
        modelTargetId: m.modelTargetId,
        modelName: m.modelTarget.modelName,
        provider: m.modelTarget.provider,
        reliabilityScore: m.reliabilityScore,
        jsonValidRate: m.jsonValidRate,
        emptyAnswerRate: m.emptyAnswerRate,
        shortAnswerRate: m.shortAnswerRate,
        citationRate: m.citationRate,
        latencyCv: m.latencyCv,
        costCv: m.costCv,
        penaltyBreakdown: breakdown.data,
        totalResponses: m.totalResponses,
      },
    ];
  });

  const questionAgreementsData = questionAgreements.flatMap((a) => {
    const outliers = outlierModelsSchema.safeParse(a.outlierModelsJson);
    if (!outliers.success) return [];
    return [
      {
        questionId: a.questionId,
        questionTitle: a.question.title,
        agreementPercent: a.agreementPercent,
        outlierModels: outliers.data,
        humanReviewFlag: a.humanReviewFlag,
      },
    ];
  });

  const recommendationResult = recommendationSchema.safeParse(
    run.recommendationJson
  );
  const recommendation = recommendationResult.success
    ? recommendationResult.data
    : null;

  return (
    <RunProgressView
      runId={runId}
      initialStatus={run.status}
      surveyId={run.survey.id}
      surveyTitle={run.survey.title}
      totalJobs={totalJobs}
      completedJobs={completedJobs}
      failedJobs={failedJobs}
      responses={responses}
      totalCostUsd={totalCostUsd}
      modelMetrics={modelMetricsData}
      questionAgreements={questionAgreementsData}
      recommendation={recommendation}
    />
  );
}
