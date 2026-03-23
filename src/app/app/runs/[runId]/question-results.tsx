"use client";

import { useState, useCallback, useTransition, memo } from "react";
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScoreBar, ModelLabel } from "./shared-components";
import { ModelComparison } from "./model-comparison";
import { CommonalitiesView } from "./commonalities-view";
import { SideBySideView } from "./side-by-side-view";
import { getResponseDebugData, setVerificationStatusAction } from "./actions";
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

function hasScore(r: ResponseData): r is ResponseData & { score: number } {
  return r.score !== null;
}

function formatAvgScore(responses: ResponseData[]): React.JSX.Element | null {
  const scores = responses.filter(hasScore).map((r) => r.score);
  if (scores.length === 0) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const config = responses[0]?.questionConfig;
  const scaleMax = typeof config?.scaleMax === "number" ? config.scaleMax : (typeof config?.max === "number" ? config.max : null);
  if (scaleMax === null) return null;
  return (
    <span className="ml-2 font-medium">
      Avg: {avg.toFixed(1)} / {scaleMax}
    </span>
  );
}

/** Render a human-readable scale description from the question config */
function formatScaleDescription(questionType: string, config: Record<string, unknown> | null): string | null {
  if (!config) return null;

  const options = config.options as Array<{ label: string; value: string }> | undefined;
  const type = config.type as string | undefined;

  if (type === "NUMERIC_SCALE" || questionType === "NUMERIC_SCALE") {
    const min = config.min as number | undefined;
    const max = config.max as number | undefined;
    const minLabel = config.minLabel as string | undefined;
    const maxLabel = config.maxLabel as string | undefined;
    if (min != null && max != null) {
      const labels = [minLabel, maxLabel].filter(Boolean).join(" – ");
      return labels ? `Scale: ${min}–${max} (${labels})` : `Scale: ${min}–${max}`;
    }
  }

  if (questionType === "RANKED") {
    const min = config.scaleMin as number | undefined;
    const max = config.scaleMax as number | undefined;
    if (min != null && max != null) return `Scale: ${min}–${max}`;
  }

  if (options && Array.isArray(options) && options.length > 0) {
    return `Options: ${options.map((o) => o.label).join(" / ")}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

function VerificationButton({
  responseId,
  currentStatus,
}: {
  responseId: string;
  currentStatus: "UNREVIEWED" | "VERIFIED" | "INACCURATE";
}): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(currentStatus);

  const handleClick = useCallback(
    (targetStatus: "VERIFIED" | "INACCURATE") => {
      startTransition(async () => {
        const newStatus = status === targetStatus ? "UNREVIEWED" : targetStatus;
        const result = await setVerificationStatusAction(responseId, newStatus);
        if (result.success) {
          setStatus(newStatus);
        }
      });
    },
    [responseId, status]
  );

  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Mark as verified"
        aria-pressed={status === "VERIFIED"}
        title="Mark as verified"
        disabled={isPending}
        className={`rounded p-0.5 transition-colors ${
          status === "VERIFIED"
            ? "text-green-600 dark:text-green-400"
            : "text-[hsl(var(--muted-foreground))] hover:text-green-600 dark:hover:text-green-400"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          handleClick("VERIFIED");
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Flag as inaccurate"
        aria-pressed={status === "INACCURATE"}
        title="Flag as inaccurate"
        disabled={isPending}
        className={`rounded p-0.5 transition-colors ${
          status === "INACCURATE"
            ? "text-red-600 dark:text-red-400"
            : "text-[hsl(var(--muted-foreground))] hover:text-red-600 dark:hover:text-red-400"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          handleClick("INACCURATE");
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      </button>
    </span>
  );
}

function verificationBorderClass(status: "UNREVIEWED" | "VERIFIED" | "INACCURATE"): string {
  switch (status) {
    case "VERIFIED":
      return "border-l-2 border-l-green-500";
    case "INACCURATE":
      return "border-l-2 border-l-red-500";
    default:
      return "border-l-2 border-l-transparent";
  }
}

// ---------------------------------------------------------------------------
// Internal: ResponseValue — display the response with confidence on hover
// ---------------------------------------------------------------------------

function ResponseValue({ response }: { response: ResponseData }): React.JSX.Element {
  const confidenceTooltip = response.confidence !== null
    ? `Confidence: ${response.confidence}%`
    : undefined;

  // Try to extract selectedValue from parsedJson in rawText for benchmark types
  let displayValue: string | null = null;

  if (response.score !== null) {
    // Ranked or numeric scale — show the score
    const config = response.questionConfig;
    const max = typeof config?.scaleMax === "number" ? config.scaleMax : (typeof config?.max === "number" ? config.max : null);
    displayValue = max !== null ? `${response.score} / ${max}` : String(response.score);
  } else if (response.answerText) {
    // Try to parse as benchmark JSON response
    try {
      const parsed = JSON.parse(response.answerText);
      if (parsed && typeof parsed === "object" && "selectedValue" in parsed) {
        // Look up the label from config options
        const options = (response.questionConfig?.options ?? []) as Array<{ value: string; label: string }>;
        const match = Array.isArray(options) ? options.find((o) => o.value === parsed.selectedValue) : null;
        displayValue = match ? match.label : String(parsed.selectedValue);
      } else if (parsed && typeof parsed === "object" && "score" in parsed) {
        displayValue = String(parsed.score);
      }
    } catch {
      // Not JSON — use as-is
    }
  }

  if (displayValue) {
    return (
      <span className="text-sm font-medium" title={confidenceTooltip}>
        {displayValue}
      </span>
    );
  }

  // Fallback: truncated text for open-ended
  const truncated = response.answerText.length > 120
    ? response.answerText.slice(0, 120) + "..."
    : response.answerText;
  return (
    <p className="truncate text-sm" title={confidenceTooltip}>
      {truncated}
    </p>
  );
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
    try {
      const result = await getResponseDebugData(response.id);
      if (result.success) {
        setDebugData({
          rawText: result.rawText,
          requestMessages: result.requestMessages,
          usageJson: result.usageJson,
        });
      }
    } finally {
      setDebugLoading(false);
    }
  }, [response.id, debugData]);

  return (
    <>
      <TableRow
        className={`cursor-pointer ${verificationBorderClass(response.verificationStatus)}`}
        onClick={onToggle}
      >
        <TableCell>
          <div className="flex items-center gap-1.5">
            <ModelLabel modelName={response.modelName} provider={response.provider} />
            <VerificationButton
              responseId={response.id}
              currentStatus={response.verificationStatus}
            />
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
          <ResponseValue response={response} />
        </TableCell>
        <TableCell className="text-right">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-label={`${response.modelName} — ${isExpanded ? "collapse" : "expand"} details`}
            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow>
          <TableCell colSpan={3} className="bg-[hsl(var(--muted))]/30 p-6">
            <div className="space-y-4">
              {/* Full answer or reasoning */}
              <div>
                <h4 className="mb-1 text-sm font-medium">
                  {response.score !== null ? "Score & Reasoning" : "Full Output"}
                </h4>
                {response.score !== null && response.questionConfig ? (
                  <div className="space-y-2">
                    <ScoreBar
                      score={response.score}
                      min={typeof response.questionConfig.scaleMin === "number" ? response.questionConfig.scaleMin : (typeof response.questionConfig.min === "number" ? response.questionConfig.min : 0)}
                      max={typeof response.questionConfig.scaleMax === "number" ? response.questionConfig.scaleMax : (typeof response.questionConfig.max === "number" ? response.questionConfig.max : 10)}
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
                    {response.citations.map((c, i) => {
                      const safeHref = /^https?:\/\//i.test(c.url) ? c.url : "#";
                      return (
                      <li key={`${c.url}-${i}`}>
                        <a
                          href={safeHref}
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
                      );
                    })}
                  </ul>
                </div>
              )}

            </div>
          </TableCell>
        </TableRow>
      )}

      {/* Debug Dialog */}
      <Dialog open={debugOpen} onOpenChange={setDebugOpen}>
        <DialogContent className="w-[80vw] max-w-[80vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              API Call — {response.provider} / {response.modelName}
            </DialogTitle>
            <DialogDescription>
              Full request and output for this LLM call
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
// QuestionTitle — truncates long titles with expand/collapse
// ---------------------------------------------------------------------------

const TITLE_TRUNCATE_LENGTH = 200;

function QuestionTitle({
  order,
  title,
  questionId,
  isExpanded,
  onToggle,
}: {
  order: number;
  title: string;
  questionId: string;
  isExpanded: boolean;
  onToggle: (questionId: string) => void;
}): React.JSX.Element {
  const isTruncatable = title.length > TITLE_TRUNCATE_LENGTH;
  const displayText =
    isTruncatable && !isExpanded
      ? title.slice(0, TITLE_TRUNCATE_LENGTH) + "…"
      : title;

  return (
    <CardTitle className="text-lg leading-snug">
      Q{order}: {displayText}
      {isTruncatable && (
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} question ${order}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(questionId);
          }}
          className="ml-1 text-sm font-normal text-[hsl(var(--primary))] hover:underline"
        >
          {isExpanded ? "show less" : "show more"}
        </button>
      )}
    </CardTitle>
  );
}

// ---------------------------------------------------------------------------
// QuestionResults
// ---------------------------------------------------------------------------

export const QuestionResults = memo(function QuestionResults({
  questionGroups,
  agreementMap: _agreementMap,
  expandedRows,
  onToggleRow,
  questionRefs,
}: QuestionResultsProps): React.JSX.Element {
  const [expandedTitles, setExpandedTitles] = useState<Set<string>>(new Set());

  const toggleTitle = useCallback((questionId: string) => {
    setExpandedTitles((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  return (
    <>
      {questionGroups.map((group) => {
        return (
          <Card
            key={group.questionId}
            ref={(el) => {
              questionRefs.current.set(group.questionId, el);
            }}
          >
            <CardHeader>
              <QuestionTitle
                order={group.questionOrder + 1}
                title={group.questionPrompt}
                questionId={group.questionId}
                isExpanded={expandedTitles.has(group.questionId)}
                onToggle={toggleTitle}
              />
              <CardDescription>
                {group.responses.length} model output
                {group.responses.length === 1 ? "" : "s"}
                {formatAvgScore(group.responses)}
                {(() => {
                  const total = group.responses.reduce((sum, r) => sum + (r.totalTokens ?? 0), 0);
                  return total > 0 ? (
                    <span className="ml-2 text-[hsl(var(--muted-foreground))]">
                      {total.toLocaleString()} tokens
                    </span>
                  ) : null;
                })()}
              </CardDescription>
              {formatScaleDescription(group.questionType, group.questionConfig) && (
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {formatScaleDescription(group.questionType, group.questionConfig)}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="responses">
                <TabsList>
                  <TabsTrigger value="responses">Responses</TabsTrigger>
                  <TabsTrigger value="comparison">Comparison</TabsTrigger>
                  <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
                </TabsList>

                <TabsContent value="responses">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model</TableHead>
                        <TableHead>Output</TableHead>
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
                </TabsContent>

                <TabsContent value="comparison">
                  <ModelComparison
                    responses={group.responses}
                    questionType={group.responses[0]?.questionType ?? "OPEN_ENDED"}
                  />
                  {group.responses.length >= 2 && (
                    <CommonalitiesView responses={group.responses} />
                  )}
                </TabsContent>

                <TabsContent value="side-by-side">
                  <SideBySideView
                    responses={group.responses}
                    questionType={group.responses[0]?.questionType ?? "OPEN_ENDED"}
                  />
                </TabsContent>
              </Tabs>

            </CardContent>
          </Card>
        );
      })}
    </>
  );
});
