"use client";

import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

export function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    QUEUED: "secondary",
    RUNNING: "default",
    COMPLETED: "default",
    FAILED: "destructive",
    CANCELLED: "outline",
    DRAFT: "outline",
  };

  return (
    <Badge variant={variants[status] ?? "secondary"}>
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// SentimentBadge
// ---------------------------------------------------------------------------

export function SentimentBadge({ score }: { score: number | null }): React.JSX.Element {
  if (score === null) return <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>;

  let color: string;
  let label: string;

  if (score > 0.3) {
    color = "text-green-600 dark:text-green-400";
    label = "Positive";
  } else if (score < -0.3) {
    color = "text-red-600 dark:text-red-400";
    label = "Negative";
  } else {
    color = "text-[hsl(var(--muted-foreground))]";
    label = "Neutral";
  }

  return (
    <span className={`text-xs font-medium ${color}`} title={score.toFixed(3)}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

export function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "success" | "error" | "info";
}): React.JSX.Element {
  const colorClass =
    variant === "success"
      ? "text-green-600 dark:text-green-400"
      : variant === "error"
        ? "text-red-600 dark:text-red-400"
        : variant === "info"
          ? "text-blue-600 dark:text-blue-400"
          : "text-[hsl(var(--foreground))]";

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScoreBar
// ---------------------------------------------------------------------------

export function ScoreBar({
  score,
  min,
  max,
}: {
  score: number;
  min: number;
  max: number;
}): React.JSX.Element {
  const raw = max > min ? ((score - min) / (max - min)) * 100 : 0;
  const percentage = Math.min(100, Math.max(0, raw));

  let colorClass: string;
  if (percentage >= 70) {
    colorClass = "bg-green-500";
  } else if (percentage >= 40) {
    colorClass = "bg-yellow-500";
  } else {
    colorClass = "bg-red-500";
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold whitespace-nowrap">
        {score} / {max}
      </span>
      <div className="h-2 flex-1 rounded-full bg-[hsl(var(--muted))]">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgreementBadge
// ---------------------------------------------------------------------------

export function AgreementBadge({
  percent,
  className = "",
}: {
  percent: number;
  className?: string;
}): React.JSX.Element {
  const pct = Math.round(percent * 100);
  let variant: "default" | "secondary" | "destructive" | "outline";

  if (pct >= 80) {
    variant = "default";
  } else if (pct >= 60) {
    variant = "secondary";
  } else {
    variant = "destructive";
  }

  return (
    <Badge variant={variant} className={className}>
      {pct}%
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// PenaltyItem
// ---------------------------------------------------------------------------

export function PenaltyItem({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}): React.JSX.Element {
  const severity = value / max;
  const color =
    severity < 0.1
      ? "text-green-600 dark:text-green-400"
      : severity < 0.5
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="rounded border border-[hsl(var(--border))] p-2">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className={`font-semibold ${color}`}>
        -{value.toFixed(2)}
      </p>
    </div>
  );
}
