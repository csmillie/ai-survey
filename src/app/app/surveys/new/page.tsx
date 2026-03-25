import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { NewEvaluationForm } from "./new-evaluation-form";

export default async function NewSurveyPage() {
  await requireSession();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/surveys"
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          &larr; Back to Evaluations
        </Link>
      </div>

      <NewEvaluationForm />
    </div>
  );
}
