import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { Prisma } from "@prisma/client";

interface SurveysPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function SurveysPage({ searchParams }: SurveysPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const isAdmin = session.role === "ADMIN";
  const viewAll = isAdmin && params.view === "all";

  const where: Prisma.SurveyWhereInput = viewAll
    ? { deletedAt: null }
    : {
        deletedAt: null,
        OR: [
          { ownerId: session.userId },
          { shares: { some: { userId: session.userId } } },
        ],
      };

  const surveys = await prisma.survey.findMany({
    where,
    include: {
      _count: { select: { questions: true } },
      owner: { select: { email: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Surveys</h1>
          {isAdmin && (
            <div className="flex rounded-md border text-sm">
              <Link
                href="/app/surveys"
                className={`px-3 py-1.5 transition-colors ${
                  !viewAll
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                My Surveys
              </Link>
              <Link
                href="/app/surveys?view=all"
                className={`px-3 py-1.5 transition-colors ${
                  viewAll
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                All Surveys
              </Link>
            </div>
          )}
        </div>
        <Link href="/app/surveys/new">
          <Button>New Survey</Button>
        </Link>
      </div>

      {surveys.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No surveys yet</h3>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Create your first survey to get started.
          </p>
          <Link href="/app/surveys/new" className="mt-4 inline-block">
            <Button variant="outline">Create Survey</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                {viewAll && <TableHead>Owner</TableHead>}
                <TableHead>Questions</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {surveys.map((survey) => (
                <TableRow key={survey.id}>
                  <TableCell>
                    <Link
                      href={`/app/surveys/${survey.id}`}
                      className="font-medium hover:underline"
                    >
                      {survey.title}
                    </Link>
                    {survey.description && (
                      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))] line-clamp-1">
                        {survey.description}
                      </p>
                    )}
                  </TableCell>
                  {viewAll && (
                    <TableCell className="text-[hsl(var(--muted-foreground))]">
                      {survey.owner.name ?? survey.owner.email}
                    </TableCell>
                  )}
                  <TableCell>{survey._count.questions}</TableCell>
                  <TableCell className="text-[hsl(var(--muted-foreground))]">
                    {survey.updatedAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {survey.ownerId === session.userId ? (
                      <Badge variant="default">Owner</Badge>
                    ) : (
                      <Badge variant="secondary">Shared</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/app/surveys/${survey.id}`}>
                      <Button variant="ghost" size="sm">
                        Open
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
