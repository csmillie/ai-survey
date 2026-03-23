import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ImportSurveyButton } from "./import-survey-button";

export default async function SurveysPage() {
  const session = await requireSession();

  const surveys = await prisma.survey.findMany({
    where: {
      deletedAt: null,
      OR: [
        { ownerId: session.userId },
        { shares: { some: { userId: session.userId } } },
      ],
    },
    include: {
      _count: { select: { questions: true, runs: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Evaluations</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Create an evaluation to see which AI models can be trusted before using them in real decisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportSurveyButton />
          <Link href="/app/surveys/new">
            <Button>New Evaluation</Button>
          </Link>
        </div>
      </div>

      {surveys.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No evaluations yet</CardTitle>
            <CardDescription>
              Evaluate which AI models can be trusted in real decision-making.
              Create your first evaluation to get started.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {surveys.map((survey) => (
            <Link key={survey.id} href={`/app/surveys/${survey.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{survey.title}</CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {survey._count.questions} prompt{survey._count.questions !== 1 ? "s" : ""}
                      {" · "}
                      {survey._count.runs} run{survey._count.runs !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {survey.description && (
                    <CardDescription>{survey.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
