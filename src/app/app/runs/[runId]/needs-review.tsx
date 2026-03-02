"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { AgreementBadge } from "./shared-components";
import type { QuestionAgreementData } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NeedsReviewProps {
  questionAgreements: QuestionAgreementData[];
  onScrollToQuestion: (questionId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NeedsReview({
  questionAgreements,
  onScrollToQuestion,
}: NeedsReviewProps): React.JSX.Element | null {
  const allFlagged = questionAgreements
    .filter((q) => q.humanReviewFlag)
    .sort((a, b) => a.agreementPercent - b.agreementPercent);
  const flagged = allFlagged.slice(0, 5);
  const totalFlagged = allFlagged.length;

  if (totalFlagged === 0) return null;

  return (
    <Card className="border-amber-500/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Badge
            variant="secondary"
            className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          >
            {totalFlagged}
          </Badge>
          Question{totalFlagged === 1 ? "" : "s"} Flagged for Review
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {flagged.map((q) => (
            <button
              key={q.questionId}
              type="button"
              className="flex w-full items-center justify-between rounded-md border border-[hsl(var(--border))] px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--muted))]/50"
              onClick={() => onScrollToQuestion(q.questionId)}
            >
              <span className="mr-3 min-w-0 truncate text-sm font-medium">
                {q.questionTitle}
              </span>
              <div className="flex flex-shrink-0 items-center gap-2">
                <AgreementBadge percent={q.agreementPercent} />
                {q.outlierModels.length > 0 && (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    Outliers: {q.outlierModels.join(", ")}
                  </span>
                )}
                {q.overconfidentModels.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    Overconfident
                  </Badge>
                )}
              </div>
            </button>
          ))}
          {totalFlagged > 5 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              +{totalFlagged - 5} more flagged question{totalFlagged - 5 === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
