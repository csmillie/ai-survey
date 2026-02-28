import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireSurveyAccess } from "@/lib/survey-auth";
import { Button } from "@/components/ui/button";
import { deleteSurveyAction } from "@/app/app/surveys/actions";
import { SurveyBuilder } from "./survey-builder";

interface SurveyDetailPageProps {
  params: Promise<{ surveyId: string }>;
}

export default async function SurveyDetailPage({
  params,
}: SurveyDetailPageProps) {
  const { surveyId } = await params;
  const session = await requireSession();

  let survey;
  try {
    survey = await requireSurveyAccess(session.userId, surveyId, "VIEW");
  } catch {
    notFound();
  }

  const fullSurvey = await prisma.survey.findUnique({
    where: { id: surveyId, deletedAt: null },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
      variables: {
        orderBy: { createdAt: "asc" },
      },
      shares: {
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!fullSurvey) {
    notFound();
  }

  // Load completed/failed runs for this survey
  const runs = await prisma.surveyRun.findMany({
    where: { surveyId },
    include: {
      createdBy: { select: { email: true } },
      _count: { select: { jobs: { where: { type: "EXECUTE_QUESTION" } } } },
      jobs: {
        where: { type: "EXECUTE_QUESTION", status: "SUCCEEDED" },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const isOwner = survey.ownerId === session.userId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/app/surveys"
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          &larr; Surveys
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/app/surveys/${surveyId}/run`}>
            <Button>Run Survey</Button>
          </Link>
          {isOwner && (
            <form action={deleteSurveyAction as unknown as (formData: FormData) => void}>
              <input type="hidden" name="surveyId" value={surveyId} />
              <Button type="submit" variant="destructive" size="sm">
                Delete
              </Button>
            </form>
          )}
        </div>
      </div>

      <SurveyBuilder
        surveyId={surveyId}
        title={fullSurvey.title}
        description={fullSurvey.description}
        questions={fullSurvey.questions.map((q) => ({
          id: q.id,
          title: q.title,
          promptTemplate: q.promptTemplate,
          mode: q.mode,
          threadKey: q.threadKey,
          order: q.order,
        }))}
        variables={fullSurvey.variables.map((v) => ({
          id: v.id,
          key: v.key,
          label: v.label,
          defaultValue: v.defaultValue,
        }))}
        shares={fullSurvey.shares.map((s) => ({
          id: s.id,
          userId: s.userId,
          email: s.user.email,
          role: s.role,
        }))}
        isOwner={isOwner}
        runs={runs.map((r) => ({
          id: r.id,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          completedAt: r.completedAt?.toISOString() ?? null,
          createdByEmail: r.createdBy.email,
          succeededJobs: r.jobs.length,
          totalJobs: r._count.jobs,
        }))}
      />
    </div>
  );
}
