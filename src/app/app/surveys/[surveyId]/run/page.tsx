import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireSurveyAccess } from "@/lib/survey-auth";
import { getMaxTokensPerRun, getMaxCostPerRunUsd } from "@/lib/env";
import { RunConfigForm } from "./run-config-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface RunConfigPageProps {
  params: Promise<{ surveyId: string }>;
}

export default async function RunConfigPage({ params }: RunConfigPageProps) {
  const { surveyId } = await params;
  const session = await requireSession();

  let survey;
  try {
    survey = await requireSurveyAccess(session.userId, surveyId, "EDIT");
  } catch {
    notFound();
  }

  // Load survey with questions and variables
  const fullSurvey = await prisma.survey.findUnique({
    where: { id: surveyId, deletedAt: null },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
      variables: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!fullSurvey) {
    notFound();
  }

  // Load all enabled model targets
  const modelTargets = await prisma.modelTarget.findMany({
    where: { isEnabled: true },
    orderBy: [{ provider: "asc" }, { modelName: "asc" }],
  });

  // Load past runs for this survey
  const pastRuns = await prisma.surveyRun.findMany({
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

  // Serialize Decimal fields to numbers for the client
  const serializedModelTargets = modelTargets.map((mt) => ({
    id: mt.id,
    provider: mt.provider,
    modelName: mt.modelName,
    isDefaultCostEffective: mt.isDefaultCostEffective,
    inputTokenCostUsd: Number(mt.inputTokenCostUsd),
    outputTokenCostUsd: Number(mt.outputTokenCostUsd),
  }));

  const limits = {
    maxTokensPerRun: getMaxTokensPerRun(),
    maxCostPerRunUsd: getMaxCostPerRunUsd(),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/app/surveys/${surveyId}`}
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          &larr; Back to Survey
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Run Survey</h1>
      </div>

      <p className="text-[hsl(var(--muted-foreground))]">
        Configure and start a new run of{" "}
        <span className="font-medium text-[hsl(var(--foreground))]">
          {survey.title}
        </span>
        . This survey has {fullSurvey.questions.length} question
        {fullSurvey.questions.length === 1 ? "" : "s"} and{" "}
        {fullSurvey.variables.length} variable
        {fullSurvey.variables.length === 1 ? "" : "s"}.
      </p>

      <RunConfigForm
        surveyId={surveyId}
        modelTargets={serializedModelTargets}
        variables={fullSurvey.variables.map((v) => ({
          id: v.id,
          key: v.key,
          label: v.label,
          defaultValue: v.defaultValue,
        }))}
        questionCount={fullSurvey.questions.length}
        limits={limits}
      />

      {/* Past Runs */}
      {pastRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Runs</CardTitle>
            <CardDescription>
              Previous runs for this survey.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <RunStatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
                      {run.startedAt
                        ? new Date(run.startedAt).toLocaleString()
                        : "--"}
                    </TableCell>
                    <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
                      {run.completedAt
                        ? new Date(run.completedAt).toLocaleString()
                        : "--"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {run.createdBy.email}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {run.jobs.length}/{run._count.jobs}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/app/runs/${run.id}`}
                        className="text-sm font-medium text-[hsl(var(--primary))] hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const variant =
    status === "COMPLETED"
      ? "default"
      : status === "FAILED"
        ? "destructive"
        : status === "CANCELLED"
          ? "outline"
          : "secondary";

  return <Badge variant={variant}>{status}</Badge>;
}
