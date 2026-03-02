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

const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","shall","can",
  "in","on","at","to","for","of","with","by","from","and","or","but","if",
  "when","where","what","which","who","how","that","this","these","those",
  "it","its","i","you","he","she","we","they",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function repeatsQuestion(claimText: string, questionText: string): boolean {
  const qWords = significantWords(questionText);
  if (qWords.size === 0) return false;
  const cWords = significantWords(claimText);
  const intersection = [...qWords].filter((w) => cWords.has(w)).length;
  const union = new Set([...qWords, ...cWords]).size;
  return intersection / union > 0.4;
}

export function TruthConfidencePanel({
  truth,
  referee,
  questionPrompt,
}: {
  truth: QuestionTruthData;
  referee?: QuestionRefereeData;
  questionPrompt?: string;
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className="mt-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {/* Header — always visible */}
      <button
        type="button"
        className="flex w-full items-center justify-between p-3 text-left hover:bg-[hsl(var(--muted))]/30"
        onClick={toggle}
        aria-expanded={isExpanded}
        aria-label={`Analysis details — ${isExpanded ? "collapse" : "expand"}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">Analysis</span>
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
          {(() => {
            const filteredClusters = truth.claimClusters
              .map((cluster) => ({
                ...cluster,
                claims: cluster.claims.filter(
                  (c) => !questionPrompt || !repeatsQuestion(c.text, questionPrompt)
                ),
              }))
              .filter((cluster) => cluster.claims.length > 0);

            return filteredClusters.length > 0 ? (
              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Claim Clusters ({filteredClusters.length})
                </h4>
                <div className="space-y-1">
                  {filteredClusters.map((cluster) => (
                    <p
                      key={`cc-${cluster.clusterId}`}
                      className="truncate text-xs text-[hsl(var(--muted-foreground))]"
                    >
                      <span className="font-medium text-[hsl(var(--foreground))]">
                        {cluster.models.join(", ")}
                      </span>
                      {cluster.claims[0] && (
                        <> — {cluster.claims[0].text}</>
                      )}
                    </p>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

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

