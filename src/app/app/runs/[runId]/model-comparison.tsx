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
import { SentimentBadge, ModelLabel } from "./shared-components";
import type { ResponseData } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

function hasScore(r: ResponseData): r is ResponseData & { score: number } {
  return r.score !== null;
}

function hasSentiment(r: ResponseData): r is ResponseData & { sentimentScore: number } {
  return r.sentimentScore !== null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelComparison({ responses, questionType }: ModelComparisonProps): React.JSX.Element {
  const isRanked = questionType === "RANKED";
  const scores = responses.filter(hasScore).map((r) => r.score);
  const sentiments = responses.filter(hasSentiment).map((r) => r.sentimentScore);

  const scoreMean = scores.length > 0 ? mean(scores) : null;
  const scoreStd = scores.length > 1 ? stddev(scores) : 0;
  const sentimentMean = sentiments.length > 0 ? mean(sentiments) : null;
  const sentStd = sentiments.length > 1 ? stddev(sentiments) : 0;

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
              {isRanked ? "Value" : "Sentiment"}
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
                  <ModelLabel modelName={resp.modelName} provider={resp.provider} />
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
                  ) : (
                    <SentimentBadge score={resp.sentimentScore} />
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
