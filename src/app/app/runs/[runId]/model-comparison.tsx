"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResponseData {
  id: string;
  modelName: string;
  provider: string;
  answerText: string;
  score: number | null;
  questionConfig: { scaleMin: number; scaleMax: number } | null;
  sentimentScore: number | null;
  verificationStatus: string;
}

interface ModelComparisonProps {
  responses: ResponseData[];
  questionType: string;
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function divergenceColor(sigmas: number): string {
  if (sigmas < 1) return "text-green-600 dark:text-green-400";
  if (sigmas < 2) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function divergenceBg(sigmas: number): string {
  if (sigmas < 1) return "";
  if (sigmas < 2) return "bg-amber-500/5";
  return "bg-red-500/5";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelComparison({ responses, questionType }: ModelComparisonProps) {
  const isRanked = questionType === "RANKED";
  const scores = responses
    .filter((r) => r.score !== null)
    .map((r) => r.score!);
  const sentiments = responses
    .filter((r) => r.sentimentScore !== null)
    .map((r) => r.sentimentScore!);

  const scoreMean = scores.length > 0 ? mean(scores) : null;
  const scoreStd = scores.length > 1 ? stddev(scores) : 0;
  const sentimentMean = sentiments.length > 0 ? mean(sentiments) : null;

  // For open-ended: compute "agreement" as % of models with same sentiment direction
  const sentimentDirections = sentiments.map((s) =>
    s > 0.3 ? "positive" : s < -0.3 ? "negative" : "neutral"
  );
  const directionCounts = new Map<string, number>();
  for (const d of sentimentDirections) {
    directionCounts.set(d, (directionCounts.get(d) ?? 0) + 1);
  }
  const majorityDirection = [...directionCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];
  const sentimentAgreement =
    sentimentDirections.length > 0 && majorityDirection
      ? majorityDirection[1] / sentimentDirections.length
      : null;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Model</TableHead>
            <TableHead>{isRanked ? "Score" : "Answer (excerpt)"}</TableHead>
            <TableHead className="text-center">
              {isRanked ? "Score" : "Sentiment"}
            </TableHead>
            <TableHead className="text-center">Divergence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {responses.map((resp) => {
            let sigmas = 0;
            if (isRanked && scoreMean !== null && scoreStd > 0 && resp.score !== null) {
              sigmas = Math.abs(resp.score - scoreMean) / scoreStd;
            } else if (
              !isRanked &&
              sentimentMean !== null &&
              resp.sentimentScore !== null
            ) {
              const sentStd = sentiments.length > 1 ? stddev(sentiments) : 0;
              sigmas =
                sentStd > 0
                  ? Math.abs(resp.sentimentScore - sentimentMean) / sentStd
                  : 0;
            }

            const truncated =
              resp.answerText.length > 80
                ? resp.answerText.slice(0, 80) + "..."
                : resp.answerText;

            return (
              <TableRow key={resp.id} className={divergenceBg(sigmas)}>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{resp.modelName}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {resp.provider}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="max-w-xs">
                  {isRanked && resp.score !== null && resp.questionConfig ? (
                    <span className="text-sm font-semibold">
                      {resp.score} / {resp.questionConfig.scaleMax}
                    </span>
                  ) : (
                    <p className="truncate text-sm">{truncated}</p>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {isRanked ? (
                    resp.score !== null ? (
                      <span className="text-sm font-medium">{resp.score}</span>
                    ) : (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
                    )
                  ) : resp.sentimentScore !== null ? (
                    <SentimentLabel score={resp.sentimentScore} />
                  ) : (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm font-medium ${divergenceColor(sigmas)}`}>
                    {sigmas.toFixed(1)}σ
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Summary row */}
      <div className="flex flex-wrap gap-3 text-sm">
        {isRanked && scoreMean !== null && (
          <>
            <Badge variant="secondary">
              Range: {Math.min(...scores)} – {Math.max(...scores)}
            </Badge>
            <Badge variant="secondary">
              Mean: {scoreMean.toFixed(1)}
            </Badge>
            <Badge variant="secondary">
              Std Dev: {scoreStd.toFixed(2)}
            </Badge>
          </>
        )}
        {!isRanked && sentimentAgreement !== null && (
          <Badge variant="secondary">
            Sentiment Agreement: {Math.round(sentimentAgreement * 100)}%
          </Badge>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SentimentLabel({ score }: { score: number }) {
  let color: string;
  let label: string;

  if (score > 0.3) {
    color = "text-green-600 dark:text-green-400";
    label = `Positive (${score.toFixed(2)})`;
  } else if (score < -0.3) {
    color = "text-red-600 dark:text-red-400";
    label = `Negative (${score.toFixed(2)})`;
  } else {
    color = "text-[hsl(var(--muted-foreground))]";
    label = `Neutral (${score.toFixed(2)})`;
  }

  return <span className={`text-xs font-medium ${color}`}>{label}</span>;
}
