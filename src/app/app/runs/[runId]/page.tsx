import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canAccessSurvey } from "@/lib/survey-auth";
import { RunProgressView } from "./run-progress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunPageProps {
  params: Promise<{ runId: string }>;
}

interface ParsedLlmResponse {
  answerText: string;
  citations: Array<{ url: string; title?: string; snippet?: string }>;
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
            select: { id: true, title: true },
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
      modelName: resp.modelTarget.modelName,
      provider: resp.modelTarget.provider,
      answerText: parsed?.answerText ?? resp.rawText,
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
    />
  );
}
