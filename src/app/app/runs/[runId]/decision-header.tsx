"use client";

import { StatusBadge, formatCost } from "./shared-components";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DecisionHeaderProps {
  surveyTitle: string;
  completedAt: string | null;
  modelCount: number;
  totalResponses: number;
  avgLatencyMs: number | null;
  totalTokens: number;
  totalCostUsd: number;
  status: string;
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
  totalResponses,
  avgLatencyMs,
  totalTokens,
  totalCostUsd,
  status,
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
          <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]" suppressHydrationWarning>
            {completedAt ? formatTimestamp(completedAt) : "In progress"}
            {" \u00b7 "}
            {modelCount} model{modelCount === 1 ? "" : "s"}
          </p>
        </div>

        {/* Right: Stats */}
        <div className="flex flex-shrink-0 items-center gap-4">
          <div className="flex gap-4 text-sm">
            <div className="text-right">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Model Outputs</p>
              <p className="font-semibold">{totalResponses}</p>
            </div>
            {avgLatencyMs !== null && (
              <div className="text-right">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Avg Latency</p>
                <p className="font-semibold">{Math.round(avgLatencyMs)}ms</p>
              </div>
            )}
            {totalTokens > 0 && (
              <div className="text-right">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Tokens</p>
                <p className="font-semibold">{totalTokens.toLocaleString()}</p>
              </div>
            )}
            {totalCostUsd > 0 && (
              <div className="text-right">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Cost</p>
                <p className="font-semibold">{formatCost(totalCostUsd)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
