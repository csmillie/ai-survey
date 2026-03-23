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

/**
 * Extract a numeric value from any response for divergence calculation.
 * - RANKED: uses resp.score directly
 * - NUMERIC_SCALE: parses score from JSON
 * - Categorical (SINGLE_SELECT, BINARY, FORCED_CHOICE, LIKERT): looks up
 *   numericValue/score from config options matching the selectedValue
 */
function getNumericValue(resp: ResponseData): number | null {
  // Direct score (RANKED)
  if (resp.score !== null) return resp.score;

  try {
    const parsed = JSON.parse(resp.answerText);
    if (!parsed || typeof parsed !== "object") return null;

    // Numeric scale score
    if ("score" in parsed && typeof parsed.score === "number") {
      return parsed.score;
    }

    // Categorical — look up numericValue from config options
    if ("selectedValue" in parsed && typeof parsed.selectedValue === "string") {
      const options = (resp.questionConfig?.options ?? []) as Array<{
        value: string;
        numericValue?: number;
        score?: number;
      }>;
      if (!Array.isArray(options)) return null;
      const match = options.find((o) => o.value === parsed.selectedValue);
      if (match) {
        return match.numericValue ?? match.score ?? null;
      }
    }
  } catch {
    // Not JSON
  }

  return null;
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
