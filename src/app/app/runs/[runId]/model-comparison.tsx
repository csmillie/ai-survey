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
import { ModelLabel, formatCost } from "./shared-components";
import type { ResponseData } from "./types";
import { getConfigOptions } from "./types";

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

/** Parse answer text as JSON once, returning null on failure */
function parseAnswerJson(answerText: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(answerText);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Extract a display string and numeric value for the response */
function getResponseValues(resp: ResponseData): { display: string; numeric: number | null } {
  if (resp.score !== null) {
    const config = resp.questionConfig;
    const max = typeof config?.scaleMax === "number"
      ? config.scaleMax
      : typeof config?.max === "number"
        ? config.max
        : null;
    const display = max !== null ? `${resp.score} / ${max}` : String(resp.score);
    return { display, numeric: resp.score };
  }

  const parsed = parseAnswerJson(resp.answerText);
  if (parsed) {
    if ("selectedValue" in parsed) {
      const options = getConfigOptions(resp.questionConfig);
      const match = options.find((o) => o.value === parsed.selectedValue);
      const display = match ? match.label : String(parsed.selectedValue);
      const numeric = match ? (match.numericValue ?? match.score ?? null) : null;
      return { display, numeric };
    }
    if ("score" in parsed && typeof parsed.score === "number") {
      return { display: String(parsed.score), numeric: parsed.score };
    }
  }

  const display = resp.answerText.length > 80
    ? resp.answerText.slice(0, 80) + "..."
    : resp.answerText;
  return { display, numeric: null };
}

/** Extract a display string for the response value */
function getResponseDisplay(resp: ResponseData): string {
  return getResponseValues(resp).display;
}

/**
 * Extract a numeric value from any response for divergence calculation.
 */
function getNumericValue(resp: ResponseData): number | null {
  return getResponseValues(resp).numeric;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelComparison({ responses }: ModelComparisonProps): React.JSX.Element {
  // Extract numeric values for all responses
  const numericPairs = responses.map((r) => ({
    response: r,
    numericValue: getNumericValue(r),
  }));

  const numericValues = numericPairs
    .map((p) => p.numericValue)
    .filter((v): v is number => v !== null);

  const valueMean = numericValues.length > 0 ? mean(numericValues) : null;
  const valueStd = numericValues.length > 1 ? stddev(numericValues) : 0;
  const hasNumericData = numericValues.length >= 2;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Model</TableHead>
            <TableHead>Response</TableHead>
            <TableHead className="text-center">Confidence</TableHead>
            <TableHead className="text-center">Tokens</TableHead>
            <TableHead className="text-center">Cost</TableHead>
            <TableHead className="text-center">Divergence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {numericPairs.map(({ response: resp, numericValue }) => {
            let sigmas = 0;
            if (hasNumericData && valueMean !== null && valueStd > 0 && numericValue !== null) {
              sigmas = Math.abs(numericValue - valueMean) / valueStd;
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
                  {resp.totalTokens !== null ? (
                    <span className="text-sm">{resp.totalTokens.toLocaleString()}</span>
                  ) : (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {resp.costUsd !== null ? (
                    <span className="text-sm">
                      {formatCost(parseFloat(resp.costUsd))}
                    </span>
                  ) : (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {hasNumericData && numericValue !== null && valueStd > 0 ? (
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
      {hasNumericData && valueMean !== null && (
        <div className="flex flex-wrap gap-3 text-sm">
          <Badge variant="secondary">
            Range: {Math.min(...numericValues)} – {Math.max(...numericValues)}
          </Badge>
          <Badge variant="secondary">
            Mean: {valueMean.toFixed(1)}
          </Badge>
          <Badge variant="secondary">
            Standard Deviation: {valueStd.toFixed(2)}
          </Badge>
        </div>
      )}
    </div>
  );
}
