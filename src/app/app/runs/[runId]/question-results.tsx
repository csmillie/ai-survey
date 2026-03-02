"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScoreBar, SentimentBadge, AgreementBadge } from "./shared-components";
import { getResponseDebugData } from "./actions";
import type { ResponseData, DebugData, QuestionGroup, QuestionAgreementData } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuestionResultsProps {
  questionGroups: QuestionGroup[];
  agreementMap: Map<string, QuestionAgreementData>;
  expandedRows: Set<string>;
  onToggleRow: (responseId: string) => void;
  questionRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeVarianceBadge(
  responses: ResponseData[]
): { label: string; variant: "secondary" | "destructive" } | null {
  const scores = responses
    .filter((r) => r.score !== null)
    .map((r) => r.score!);
  if (scores.length < 2) return null;

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (mean === 0) return null;

  const variance =
    scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / Math.abs(mean);

  if (cv < 0.15) return { label: "Low variance", variant: "secondary" };
  if (cv < 0.30) return { label: "Med variance", variant: "secondary" };
  return { label: "High variance", variant: "destructive" };
}

// ---------------------------------------------------------------------------
// Internal: ResponseRow
// ---------------------------------------------------------------------------

function ResponseRow({
  response,
  isExpanded,
  onToggle,
}: {
  response: ResponseData;
  isExpanded: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);

  const handleDebugOpen = useCallback(async () => {
    setDebugOpen(true);
    if (debugData) return;
    setDebugLoading(true);
    const result = await getResponseDebugData(response.id);
    if (result.success) {
      setDebugData({
        rawText: result.rawText,
        requestMessages: result.requestMessages,
        usageJson: result.usageJson,
      });
    }
    setDebugLoading(false);
  }, [response.id, debugData]);

  const truncatedAnswer =
    response.answerText.length > 120
      ? response.answerText.slice(0, 120) + "..."
      : response.answerText;

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <>
      <TableRow
        className="cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
      >
        <TableCell>
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{response.modelName}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {response.provider}
            </span>
            <button
              type="button"
              title="View API call details"
              className="ml-1 rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              onClick={(e) => {
                e.stopPropagation();
                handleDebugOpen();
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </button>
          </div>
        </TableCell>
        <TableCell className="max-w-md">
          {response.score !== null && response.questionConfig ? (
            <ScoreBar
              score={response.score}
              min={response.questionConfig.scaleMin}
              max={response.questionConfig.scaleMax}
            />
          ) : (
            <p className="truncate text-sm">{truncatedAnswer}</p>
          )}
        </TableCell>
        <TableCell className="text-center">
          <SentimentBadge score={response.sentimentScore} />
        </TableCell>
        <TableCell className="text-center">
          <span className="text-sm">{response.citations.length}</span>
        </TableCell>
        <TableCell className="text-right text-sm">
          {response.costUsd ? `$${parseFloat(response.costUsd).toFixed(6)}` : "-"}
        </TableCell>
        <TableCell className="text-right text-sm">
          {response.latencyMs ? `${response.latencyMs}ms` : "-"}
        </TableCell>
        <TableCell className="text-right">
          <button
            type="button"
            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-[hsl(var(--muted))]/30 p-6">
            <div className="space-y-4">
              {/* Full answer or reasoning */}
              <div>
                <h4 className="mb-1 text-sm font-medium">
                  {response.score !== null ? "Score & Reasoning" : "Full Answer"}
                </h4>
                {response.score !== null && response.questionConfig ? (
                  <div className="space-y-2">
                    <ScoreBar
                      score={response.score}
                      min={response.questionConfig.scaleMin}
                      max={response.questionConfig.scaleMax}
                    />
                    {response.reasoningText && (
                      <p className="whitespace-pre-wrap text-sm text-[hsl(var(--muted-foreground))]">
                        {response.reasoningText}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">
                    {response.answerText}
                  </p>
                )}
              </div>

              {/* Citations */}
              {response.citations.length > 0 && (
                <div>
                  <h4 className="mb-1 text-sm font-medium">Citations</h4>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {response.citations.map((c, i) => (
                      <li key={i}>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[hsl(var(--primary))] underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.title || c.url}
                        </a>
                        {c.snippet && (
                          <span className="ml-2 text-[hsl(var(--muted-foreground))]">
                            - {c.snippet}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Analysis */}
              <div>
                <h4 className="mb-1 text-sm font-medium">Analysis</h4>
                <div className="flex flex-wrap gap-2">
                  {response.sentimentScore !== null && (
                    <Badge variant="secondary">
                      Sentiment: {response.sentimentScore.toFixed(3)}
                    </Badge>
                  )}
                  {response.flags.length > 0 &&
                    response.flags.map((flag) => (
                      <Badge key={flag} variant="destructive">
                        {flag}
                      </Badge>
                    ))}
                  {response.brandMentions.length > 0 && (
                    <Badge variant="secondary">
                      Brands: {response.brandMentions.join(", ")}
                    </Badge>
                  )}
                  {response.institutionMentions.length > 0 && (
                    <Badge variant="secondary">
                      Institutions: {response.institutionMentions.join(", ")}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Entities */}
              {response.entities && (
                <div>
                  <h4 className="mb-1 text-sm font-medium">Entities</h4>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {response.entities.people.length > 0 && (
                      <span>
                        <strong>People:</strong>{" "}
                        {response.entities.people.join(", ")}
                      </span>
                    )}
                    {response.entities.places.length > 0 && (
                      <span>
                        <strong>Places:</strong>{" "}
                        {response.entities.places.join(", ")}
                      </span>
                    )}
                    {response.entities.organizations.length > 0 && (
                      <span>
                        <strong>Organizations:</strong>{" "}
                        {response.entities.organizations.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}

      {/* Debug Dialog */}
      <Dialog open={debugOpen} onOpenChange={setDebugOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              API Call — {response.provider} / {response.modelName}
            </DialogTitle>
            <DialogDescription>
              Full request and response for this LLM call
              {debugData?.usageJson && (
                <span className="ml-2">
                  ({debugData.usageJson.inputTokens.toLocaleString()} input /{" "}
                  {debugData.usageJson.outputTokens.toLocaleString()} output tokens)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {debugLoading ? (
              <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                Loading...
              </p>
            ) : debugData ? (
              <>
                {/* Request Messages */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Request Messages</h4>
                  {debugData.requestMessages ? (
                    <div className="space-y-3">
                      {debugData.requestMessages.map((msg, i) => (
                        <div key={`${msg.role}-${i}`}>
                          <Badge
                            variant={
                              msg.role === "system"
                                ? "secondary"
                                : msg.role === "assistant"
                                  ? "outline"
                                  : "default"
                            }
                            className="mb-1"
                          >
                            {msg.role}
                          </Badge>
                          <pre className="mt-1 whitespace-pre-wrap rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-3 text-xs font-mono">
                            {msg.content}
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      Request data not available for this response.
                    </p>
                  )}
                </div>

                {/* Raw Response */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Raw Response</h4>
                  <pre className="whitespace-pre-wrap rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-3 text-xs font-mono">
                    {debugData.rawText}
                  </pre>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                Failed to load debug data.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// QuestionResults
// ---------------------------------------------------------------------------

export function QuestionResults({
  questionGroups,
  agreementMap,
  expandedRows,
  onToggleRow,
  questionRefs,
}: QuestionResultsProps): React.JSX.Element {
  return (
    <>
      {questionGroups.map((group) => {
        const agreement = agreementMap.get(group.questionId);
        const varianceBadge = computeVarianceBadge(group.responses);

        return (
          <Card
            key={group.questionId}
            ref={(el) => {
              questionRefs.current.set(group.questionId, el);
            }}
          >
            <CardHeader>
              <CardTitle className="text-lg">{group.questionTitle}</CardTitle>
              <CardDescription>
                {group.responses.length} response
                {group.responses.length === 1 ? "" : "s"}
                {(() => {
                  const scores = group.responses
                    .filter((r) => r.score !== null)
                    .map((r) => r.score!);
                  if (scores.length === 0) return null;
                  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                  const config = group.responses[0]?.questionConfig;
                  return config ? (
                    <span className="ml-2 font-medium">
                      Avg: {avg.toFixed(1)} / {config.scaleMax}
                    </span>
                  ) : null;
                })()}
                {agreement && (
                  <>
                    <AgreementBadge percent={agreement.agreementPercent} className="ml-2" />
                    {agreement.humanReviewFlag && (
                      <Badge variant="destructive" className="ml-1">
                        Needs Review
                      </Badge>
                    )}
                  </>
                )}
                {varianceBadge && (
                  <Badge variant={varianceBadge.variant} className="ml-2">
                    {varianceBadge.label}
                  </Badge>
                )}
                {agreement && agreement.outlierModels.length > 0 && (
                  <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                    Outliers: {agreement.outlierModels.join(", ")}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Answer</TableHead>
                    <TableHead className="text-center">Sentiment</TableHead>
                    <TableHead className="text-center">Citations</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.responses.map((resp) => {
                    const isExpanded = expandedRows.has(resp.id);
                    return (
                      <ResponseRow
                        key={resp.id}
                        response={resp}
                        isExpanded={isExpanded}
                        onToggle={() => onToggleRow(resp.id)}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
