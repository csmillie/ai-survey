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
import { ModelLabel } from "./shared-components";
import type { ResponseData } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelComparisonProps {
  responses: ResponseData[];
  questionType: string;
}

// ---------------------------------------------------------------------------
// Helpers
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

/** Extract a display string for the response value */
function getResponseDisplay(resp: ResponseData): string {
  if (resp.score !== null) {
    const config = resp.questionConfig;
    const max = typeof config?.scaleMax === "number"
      ? config.scaleMax
      : typeof config?.max === "number"
        ? config.max
        : null;
    return max !== null ? `${resp.score} / ${max}` : String(resp.score);
  }

  // Try parsing benchmark JSON response
  try {
    const parsed = JSON.parse(resp.answerText);
    if (parsed && typeof parsed === "object" && "selectedValue" in parsed) {
      const options = (resp.questionConfig?.options ?? []) as Array<{ value: string; label: string }>;
      const match = Array.isArray(options) ? options.find((o) => o.value === parsed.selectedValue) : null;
      return match ? match.label : String(parsed.selectedValue);
    }
    if (parsed && typeof parsed === "object" && "score" in parsed) {
      return String(parsed.score);
    }
  } catch {
    // Not JSON
  }

  return resp.answerText.length > 80
    ? resp.answerText.slice(0, 80) + "..."
    : resp.answerText;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelComparison({ responses, questionType }: ModelComparisonProps): React.JSX.Element {
  const isRanked = questionType === "RANKED";
  const scores = responses.filter(hasScore).map((r) => r.score);

  const scoreMean = scores.length > 0 ? mean(scores) : null;
  const scoreStd = scores.length > 1 ? stddev(scores) : 0;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Model</TableHead>
            <TableHead>Response</TableHead>
            <TableHead className="text-center">Confidence</TableHead>
            <TableHead className="text-center">Divergence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {responses.map((resp) => {
            let sigmas = 0;
            if (isRanked && scoreMean !== null && scoreStd > 0 && resp.score !== null) {
              sigmas = Math.abs(resp.score - scoreMean) / scoreStd;
            }

            return (
              <TableRow key={resp.id} className={divergenceBg(sigmas)}>
                <TableCell>
                  <ModelLabel modelName={resp.modelName} provider={resp.provider} />
                </TableCell>
                <TableCell className="max-w-xs">
                  <span className="text-sm">{getResponseDisplay(resp)}</span>
                </TableCell>
                <TableCell className="text-center">
                  {resp.confidence !== null ? (
                    <Badge variant="secondary">{resp.confidence}%</Badge>
                  ) : (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {isRanked && scoreStd > 0 ? (
                    <span className={`text-sm font-medium ${divergenceColor(sigmas)}`}>
                      {sigmas.toFixed(1)}&sigma;
                    </span>
                  ) : (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Summary row */}
      {isRanked && scoreMean !== null && (
        <div className="flex flex-wrap gap-3 text-sm">
          <Badge variant="secondary">
            Range: {Math.min(...scores)} – {Math.max(...scores)}
          </Badge>
          <Badge variant="secondary">
            Mean: {scoreMean.toFixed(1)}
          </Badge>
          <Badge variant="secondary">
            Std Dev: {scoreStd.toFixed(2)}
          </Badge>
        </div>
      )}
    </div>
  );
}
