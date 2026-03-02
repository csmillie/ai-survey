"use client";

import { Badge } from "@/components/ui/badge";
import type { QuestionAgreementData, ClaimCategory } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FactConfidenceCardProps {
  agreement: QuestionAgreementData;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceLevelColor(level: string): string {
  switch (level) {
    case "high":
      return "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700";
    case "medium":
      return "bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700";
    case "low":
      return "bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700";
    default:
      return "bg-[hsl(var(--muted))] border-[hsl(var(--border))]";
  }
}

function confidenceLevelTextColor(level: string): string {
  switch (level) {
    case "high":
      return "text-green-800 dark:text-green-300";
    case "medium":
      return "text-yellow-800 dark:text-yellow-300";
    case "low":
      return "text-red-800 dark:text-red-300";
    default:
      return "text-[hsl(var(--muted-foreground))]";
  }
}

function confidenceLevelBadgeVariant(
  level: string
): "secondary" | "destructive" | "default" {
  switch (level) {
    case "high":
      return "secondary";
    case "low":
      return "destructive";
    default:
      return "default";
  }
}

function signalIcon(signal: string): string {
  // Positive signals
  if (
    signal.includes("agreement") ||
    signal.includes("consistent") ||
    signal.includes("all models provided") ||
    signal.includes("overlapping") ||
    signal.includes("multiple citations")
  ) {
    return "+";
  }
  // Negative signals (includes category-specific like "percentage disagreement")
  if (
    signal.includes("disagreement") ||
    signal.includes("missing") ||
    signal.includes("no models") ||
    signal.includes("single model") ||
    signal.includes("low agreement")
  ) {
    return "-";
  }
  return " ";
}

function signalColor(signal: string): string {
  const icon = signalIcon(signal);
  if (icon === "+") return "text-green-700 dark:text-green-400";
  if (icon === "-") return "text-red-700 dark:text-red-400";
  return "text-[hsl(var(--muted-foreground))]";
}

function categoryHeading(category: ClaimCategory | undefined): string {
  switch (category) {
    case "percentage":
      return "Percentage";
    case "currency":
      return "Dollar Amount";
    case "year":
      return "Year";
    case "rating":
      return "Rating / Score";
    default:
      return "Numeric";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FactConfidenceCard({
  agreement,
}: FactConfidenceCardProps): React.JSX.Element | null {
  const { factConfidenceLevel, factConfidenceSignals, factComparison } =
    agreement;

  if (!factConfidenceLevel) return null;

  const level = factConfidenceLevel;
  const signals = factConfidenceSignals;

  return (
    <div
      className={`rounded-lg border p-3 ${confidenceLevelColor(level)}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-semibold ${confidenceLevelTextColor(level)}`}
        >
          Fact Confidence:{" "}
          <span className="capitalize">{level}</span>
        </span>
        {agreement.factConfidenceScore !== null && (
          <Badge variant={confidenceLevelBadgeVariant(level)}>
            {agreement.factConfidenceScore}/100
          </Badge>
        )}
      </div>

      {signals.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {signals.map((signal) => (
            <li
              key={signal}
              className={`text-xs ${signalColor(signal)}`}
            >
              <span className="mr-1 font-mono">
                {signalIcon(signal) === "+" ? "+" : signalIcon(signal) === "-" ? "-" : " "}
              </span>
              {signal}
            </li>
          ))}
        </ul>
      )}

      {factComparison && factComparison.numericDisagreements.length > 0 && (
        <div className="mt-2 border-t border-[hsl(var(--border))]/50 pt-2">
          {/* Group disagreements by category */}
          {(() => {
            const byCategory = new Map<
              string,
              typeof factComparison.numericDisagreements
            >();
            for (const d of factComparison.numericDisagreements) {
              const key = d.category ?? "numeric";
              const list = byCategory.get(key);
              if (list) {
                list.push(d);
              } else {
                byCategory.set(key, [d]);
              }
            }
            return [...byCategory.entries()].map(([cat, items]) => (
              <div key={cat} className="mb-1">
                <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  {categoryHeading(cat === "numeric" ? undefined : (cat as ClaimCategory))} Disagreements:
                </p>
                {items.map((d, dIdx) => (
                  <div key={`${d.claim}-${dIdx}`} className="mt-1 text-xs">
                    {d.values.map((v, vIdx) => (
                      <span
                        key={`${d.claim}-${v.modelName}-${vIdx}`}
                        className="mr-2 inline-block"
                      >
                        <span className="font-medium">{v.modelName}:</span>{" "}
                        <span className="text-[hsl(var(--muted-foreground))]">
                          {v.raw}
                        </span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ));
          })()}
        </div>
      )}

      {factComparison &&
        factComparison.sharedDomains.length > 0 && (
          <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            Shared sources:{" "}
            {factComparison.sharedDomains.join(", ")}
          </div>
        )}
    </div>
  );
}
