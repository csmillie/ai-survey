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
        <h1 className="text-2xl font-bold">Surveys</h1>
        <Link href="/app/surveys/new">
          <Button>New Survey</Button>
        </Link>
      </div>

      {surveys.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No surveys yet</CardTitle>
            <CardDescription>
              Create your first survey to get started.
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
                      {survey._count.questions} question{survey._count.questions !== 1 ? "s" : ""}
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
