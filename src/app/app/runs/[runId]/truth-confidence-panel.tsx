"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import type {
  QuestionTruthData,
  QuestionRefereeData,
} from "./types";

// ---------------------------------------------------------------------------
// TruthConfidenceBadge
// ---------------------------------------------------------------------------

export function TruthConfidenceBadge({
  truth,
  className = "",
}: {
  truth: QuestionTruthData;
  className?: string;
}): React.JSX.Element {
  let variant: "default" | "secondary" | "destructive";
  if (truth.truthLabel === "HIGH") {
    variant = "default";
  } else if (truth.truthLabel === "MEDIUM") {
    variant = "secondary";
  } else {
    variant = "destructive";
  }

  return (
    <Badge variant={variant} className={className}>
      Truth: {Math.round(truth.truthScore)} ({truth.truthLabel})
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// TruthConfidencePanel (expandable)
// ---------------------------------------------------------------------------

export function TruthConfidencePanel({
  truth,
  referee,
}: {
  truth: QuestionTruthData;
  referee?: QuestionRefereeData;
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const bd = truth.breakdown;

  return (
    <div className="mt-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {/* Header — always visible */}
      <button
        type="button"
        className="flex w-full items-center justify-between p-3 text-left hover:bg-[hsl(var(--muted))]/30"
        onClick={toggle}
        aria-expanded={isExpanded}
        aria-label={`Truth confidence details — ${isExpanded ? "collapse" : "expand"}`}
      >
        <div className="flex items-center gap-2">
          <TruthConfidenceBadge truth={truth} />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            Consensus: {Math.round(truth.consensusPercent * 100)}% |
            Citations: {Math.round(truth.citationRate * 100)}%
            {truth.numericDisagreements.length > 0 && (
              <span className="ml-1 text-red-600 dark:text-red-400">
                | {truth.numericDisagreements.length} numeric disagreement{truth.numericDisagreements.length > 1 ? "s" : ""}
              </span>
            )}
          </span>
        </div>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {isExpanded ? "Collapse" : "Expand"}
        </span>
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="border-t border-[hsl(var(--border))] p-4 space-y-4">
          {/* Score Breakdown */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">Score Breakdown</h4>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <BreakdownItem label="Base" value={bd.baseScore} />
              <BreakdownItem label="Consensus" value={bd.consensusBonus} positive />
              <BreakdownItem label="Citation Bonus" value={bd.citationBonus} positive />
              <BreakdownItem label="Citation Penalty" value={bd.citationPenalty} />
              <BreakdownItem label="Numeric Disagree" value={bd.numericDisagreementPenalty} />
              <BreakdownItem label="Assertion Disagree" value={bd.assertionDisagreementPenalty} />
              <BreakdownItem label="Empty/Short" value={bd.emptyShortPenalty} />
              <div className="rounded border border-[hsl(var(--border))] p-2">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Final Score</p>
                <p className="font-bold">{bd.finalScore}</p>
              </div>
            </div>
          </div>

          {/* Numeric Disagreements */}
          {truth.numericDisagreements.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Numeric Disagreements</h4>
              <div className="space-y-2">
                {truth.numericDisagreements.map((d, i) => (
                  <div
                    key={`nd-${i}`}
                    className="rounded border border-red-200 bg-red-50 p-2 text-sm dark:border-red-800 dark:bg-red-950"
                  >
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                      Max delta: {d.maxDelta.toFixed(2)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {d.values.map((v, j) => (
                        <Badge key={`ndv-${i}-${j}`} variant="outline">
                          {v.modelKey}: {v.value}{v.unit ?? ""}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Claim Clusters */}
          {truth.claimClusters.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">
                Claim Clusters ({truth.claimClusters.length})
              </h4>
              <div className="space-y-2">
                {truth.claimClusters.map((cluster) => (
                  <div
                    key={`cc-${cluster.clusterId}`}
                    className="rounded border border-[hsl(var(--border))] p-2 text-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary">
                        {cluster.kind}
                      </Badge>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        Models: {cluster.models.join(", ")}
                      </span>
                    </div>
                    {cluster.claims.slice(0, 2).map((claim, ci) => (
                      <p
                        key={`cc-${cluster.clusterId}-${ci}`}
                        className="text-xs text-[hsl(var(--muted-foreground))] truncate"
                      >
                        [{claim.modelKey}] {claim.text}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Referee Summary */}
          {referee && (
            <div className="border-t border-[hsl(var(--border))] pt-4">
              <h4 className="mb-2 text-sm font-semibold">
                AI Referee ({referee.refereeModelKey})
                <span className="ml-2 font-normal text-xs text-[hsl(var(--muted-foreground))]">
                  Confidence: {referee.confidence}%
                </span>
              </h4>
              <p className="text-sm mb-3">{referee.summary}</p>

              {/* Referee Disagreements */}
              {referee.disagreements.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-xs font-semibold mb-1">Disagreements Found</h5>
                  <div className="space-y-1">
                    {referee.disagreements.map((d, i) => (
                      <div
                        key={`rd-${i}`}
                        className="flex items-start gap-2 text-xs"
                      >
                        <Badge
                          variant={
                            d.severity === "high"
                              ? "destructive"
                              : d.severity === "medium"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {d.severity}
                        </Badge>
                        <span>
                          <strong>[{d.type}]</strong> {d.description}
                          {d.models.length > 0 && (
                            <span className="text-[hsl(var(--muted-foreground))]">
                              {" "}({d.models.join(", ")})
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verification Checklist */}
              {referee.verifyChecklist.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-xs font-semibold mb-1">Verification Checklist</h5>
                  <ul className="space-y-1 text-xs">
                    {referee.verifyChecklist.map((item, i) => (
                      <li key={`vc-${i}`} className="flex gap-1">
                        <span className="text-[hsl(var(--muted-foreground))]">-</span>
                        <div>
                          <span className="font-medium">{item.item}</span>
                          <span className="text-[hsl(var(--muted-foreground))]">
                            {" "}— {item.why}
                          </span>
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            {item.suggested_source}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Model */}
              {referee.recommendedAnswerModelKey && (
                <p className="text-xs">
                  Recommended model:{" "}
                  <span className="font-semibold">
                    {referee.recommendedAnswerModelKey}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal: BreakdownItem
// ---------------------------------------------------------------------------

function BreakdownItem({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
}): React.JSX.Element {
  let color: string;
  if (value === 0) {
    color = "text-[hsl(var(--muted-foreground))]";
  } else if (positive) {
    color = "text-green-600 dark:text-green-400";
  } else if (value < 0) {
    color = "text-red-600 dark:text-red-400";
  } else {
    color = "text-[hsl(var(--foreground))]";
  }

  return (
    <div className="rounded border border-[hsl(var(--border))] p-2">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className={`font-semibold ${color}`}>
        {value > 0 && positive ? "+" : ""}
        {value}
      </p>
    </div>
  );
}
