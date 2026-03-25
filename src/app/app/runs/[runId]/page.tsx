import { z } from "zod";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canAccessSurvey } from "@/lib/survey-auth";
import {
  outlierModelsSchema,
  overconfidentModelsSchema,
  factConfidenceSignalsSchema,
  factComparisonSchema,
  llmResponseSchema,
} from "@/lib/schemas";
import { RunProgressView } from "./run-progress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunPageProps {
  params: Promise<{ runId: string }>;
}

interface AnalysisEntities {
  people: string[];
  places: string[];
  organizations: string[];
}

const usageJsonSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
});

function parseUsageJson(raw: unknown): { inputTokens?: number; outputTokens?: number } | null {
  const result = usageJsonSchema.safeParse(raw);
  return result.success ? result.data : null;
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
      models: {
        select: { modelTargetId: true },
      },
      jobs: {
        where: { type: "EXECUTE_QUESTION" },
        select: { status: true },
      },
      responses: {
        include: {
          question: {
            select: { id: true, title: true, promptTemplate: true, type: true, configJson: true, order: true },
          },
          modelTarget: {
            select: { modelName: true, provider: true, inputTokenCostUsd: true, outputTokenCostUsd: true },
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

  // Determine if background analysis (COMPUTE_METRICS) has finished so the
  // client can show a "calculating…" banner while it's still running.
  const initialAnalysisComplete = await (async () => {
    if (run.status !== "COMPLETED") return true; // not relevant until run finishes
    const metricsJob = await prisma.job.findFirst({
      where: { runId, type: "COMPUTE_METRICS" },
      select: { status: true },
      orderBy: { createdAt: "desc" },
    });
    return !metricsJob || metricsJob.status === "SUCCEEDED" || metricsJob.status === "FAILED";
  })();

  // Build a 0-indexed rank map so question numbers always display as 1, 2, 3…
  // regardless of stale stored order values (e.g. after pre-fix deletions).
  const questionRankMap = new Map(
    [...new Map(run.responses.map((r) => [r.question.id, r.question.order])).entries()]
      .sort(([, oa], [, ob]) => oa - ob)
      .map(([id], idx) => [id, idx])
  );

  // Transform responses for the client component
  const responses = run.responses.map((resp) => {
    const parsedResult = llmResponseSchema.safeParse(resp.parsedJson);
    const parsed = parsedResult.success ? parsedResult.data : null;

    return {
      id: resp.id,
      questionId: resp.question.id,
      questionTitle: resp.question.title,
      questionPrompt: resp.question.promptTemplate,
      questionType: resp.question.type,
      questionOrder: questionRankMap.get(resp.question.id) ?? resp.question.order,
      questionConfig: z.record(z.string(), z.unknown()).nullable().catch(null).parse(resp.question.configJson),
      modelName: resp.modelTarget.modelName,
      provider: resp.modelTarget.provider,
      answerText: parsed?.answerText ?? (parsed?.score != null ? "" : resp.rawText),
      score: parsed?.score ?? null,
      reasoningText: resp.reasoningText ?? null,
      citations: parsed?.citations ?? [],
      sentimentScore: resp.analysis?.sentimentScore ?? null,
      confidence: resp.confidence ?? (() => {
        // Fallback: extract confidence from raw JSON for responses stored before
        // the benchmark handler populated the dedicated column.
        try {
          const raw = typeof resp.parsedJson === "object" && resp.parsedJson !== null
            ? resp.parsedJson as Record<string, unknown>
            : JSON.parse(resp.rawText);
          const c = raw?.confidence;
          return typeof c === "number" && c >= 0 && c <= 100 ? Math.round(c) : null;
        } catch { return null; }
      })(),
      normalizedScore: resp.normalizedScore ?? null,
      selectedOptionValue: resp.selectedOptionValue ?? null,
      matrixRowKey: resp.matrixRowKey ?? null,
      verificationStatus: resp.verificationStatus,
      costUsd: (() => {
        const stored = resp.costUsd ? Number(resp.costUsd) : 0;
        if (stored > 0) return stored.toString();
        // Recompute from tokens and model pricing when stored value is zero
        const usage = parseUsageJson(resp.usageJson);
        if (usage && typeof usage.inputTokens === "number" && typeof usage.outputTokens === "number") {
          const inputCost = (usage.inputTokens * Number(resp.modelTarget.inputTokenCostUsd)) / 1_000_000;
          const outputCost = (usage.outputTokens * Number(resp.modelTarget.outputTokenCostUsd)) / 1_000_000;
          const total = inputCost + outputCost;
          if (total > 0) return total.toString();
        }
        return null;
      })(),
      latencyMs: resp.latencyMs,
      totalTokens: (() => {
        const usage = parseUsageJson(resp.usageJson);
        if (usage && typeof usage.inputTokens === "number" && typeof usage.outputTokens === "number") {
          return usage.inputTokens + usage.outputTokens;
        }
        return null;
      })(),
      flags: (resp.analysis?.flagsJson as string[] | null) ?? [],
      brandMentions:
        (resp.analysis?.brandMentionsJson as string[] | null) ?? [],
      institutionMentions:
        (resp.analysis?.institutionMentionsJson as string[] | null) ?? [],
      entities:
        (resp.analysis?.entitiesJson as AnalysisEntities | null) ?? null,
    };
  });

  // Load ModelTrust metrics + Truth Engine data (may be empty for older runs)
  const questionAgreements = await prisma.runQuestionAgreement.findMany({
    where: { runId },
    include: {
      question: {
        select: { title: true, promptTemplate: true, order: true },
      },
    },
    orderBy: { agreementPercent: "asc" },
  });

  const _questionAgreementsData = questionAgreements.flatMap((a) => {
    const outliers = outlierModelsSchema.safeParse(a.outlierModelsJson);
    if (!outliers.success) return [];
    const overconfident = overconfidentModelsSchema.safeParse(a.overconfidentModelsJson);
    const signals = factConfidenceSignalsSchema.parse(a.factConfidenceSignals);
    const comparison = factComparisonSchema.parse(a.factComparisonJson);
    return [
      {
        questionId: a.questionId,
        questionTitle: a.question.title,
        questionPrompt: a.question.promptTemplate,
        questionOrder: questionRankMap.get(a.questionId) ?? a.question.order,
        agreementPercent: a.agreementPercent,
        outlierModels: outliers.data,
        humanReviewFlag: a.humanReviewFlag,
        overconfidentModels: overconfident.success ? overconfident.data : [],
        factConfidenceLevel: a.factConfidenceLevel,
        factConfidenceScore: a.factConfidenceScore,
        factConfidenceSignals: signals ?? [],
        factComparison: comparison,
      },
    ];
  });

  // Compute avg latency from responses that have latency data
  const latencies = responses
    .map((r) => r.latencyMs)
    .filter((ms): ms is number => ms !== null);
  const avgLatencyMs =
    latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : null;

  return (
    <RunProgressView
      runId={runId}
      initialStatus={run.status}
      initialAnalysisComplete={initialAnalysisComplete}
      surveyTitle={run.survey.title}
      totalJobs={totalJobs}
      completedJobs={completedJobs}
      failedJobs={failedJobs}
      responses={responses}
      completedAt={run.completedAt?.toISOString() ?? null}
      modelCount={run.models.length}
      avgLatencyMs={avgLatencyMs}
    />
  );
}
