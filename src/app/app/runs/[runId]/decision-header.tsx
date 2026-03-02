"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./shared-components";
import type { RecommendationData } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DecisionHeaderProps {
  surveyTitle: string;
  completedAt: string | null;
  modelCount: number;
  recommendation: RecommendationData | null;
  totalResponses: number;
  totalCostUsd: number;
  avgLatencyMs: number | null;
  status: string;
  onExport: () => void;
  isExporting: boolean;
  exportSuccess: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DecisionHeader({
  surveyTitle,
  completedAt,
  modelCount,
  recommendation,
  totalResponses,
  totalCostUsd,
  avgLatencyMs,
  status,
  onExport,
  isExporting,
  exportSuccess,
}: DecisionHeaderProps): React.JSX.Element {
  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/60">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Left: Title, timestamp, model count */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {surveyTitle}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
            {completedAt ? formatTimestamp(completedAt) : "In progress"}
            {" \u00b7 "}
            {modelCount} model{modelCount === 1 ? "" : "s"}
          </p>
        </div>

        {/* Center: Recommendation pill */}
        {recommendation && (
          <div className="flex-shrink-0">
            {recommendation.humanReviewRequired ? (
              <Badge
                variant="secondary"
                className="border-amber-500/50 bg-amber-500/10 px-4 py-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400"
              >
                Human Review Required
              </Badge>
            ) : recommendation.recommendedModelName ? (
              <Badge
                variant="secondary"
                className="border-green-500/50 bg-green-500/10 px-4 py-1.5 text-sm font-semibold text-green-700 dark:text-green-400"
              >
                Recommended: {recommendation.recommendedModelName}
                {recommendation.reliabilityScore !== null && (
                  <span className="ml-1.5 opacity-75">
                    ({recommendation.reliabilityScore.toFixed(1)}/10)
                  </span>
                )}
              </Badge>
            ) : null}
          </div>
        )}

        {/* Right: Stats + Export */}
        <div className="flex flex-shrink-0 items-center gap-4">
          <div className="flex gap-4 text-sm">
            <div className="text-right">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Model Outputs</p>
              <p className="font-semibold">{totalResponses}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Cost</p>
              <p className="font-semibold">${totalCostUsd.toFixed(4)}</p>
            </div>
            {avgLatencyMs !== null && (
              <div className="text-right">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Avg Latency</p>
                <p className="font-semibold">{Math.round(avgLatencyMs)}ms</p>
              </div>
            )}
          </div>
          {status === "COMPLETED" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onExport}
              disabled={isExporting || exportSuccess}
            >
              {isExporting ? "Exporting..." : exportSuccess ? "Export Queued" : "Export CSV"}
            </Button>
          )}
        </div>
      </div>

      {/* Recommendation reason */}
      {recommendation?.reason && (
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          {recommendation.reason}
        </p>
      )}
    </div>
  );
}
