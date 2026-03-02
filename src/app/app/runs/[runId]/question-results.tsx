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
import { ScoreBar, SentimentBadge, AgreementBadge, ModelLabel } from "./shared-components";
import { ModelComparison } from "./model-comparison";
import { SideBySideView } from "./side-by-side-view";
import { FactConfidenceCard } from "./fact-confidence-card";
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
  if (!config) return null;
  return (
    <span className="ml-2 font-medium">
      Avg: {avg.toFixed(1)} / {config.scaleMax}
    </span>
  );
}

function computeVarianceBadge(
  responses: ResponseData[]
): { label: string; variant: "secondary" | "destructive" } | null {
  const scores = responses.filter(hasScore).map((r) => r.score);
  if (scores.length < 2) return null;

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);

  // When mean is near zero, CV is unstable — fall back to absolute stddev
  if (Math.abs(mean) < 0.01) {
    if (stddev < 0.5) return { label: "Low variance", variant: "secondary" };
    if (stddev < 1.5) return { label: "Med variance", variant: "secondary" };
    return { label: "High variance", variant: "destructive" };
  }

  const cv = stddev / Math.abs(mean);
  if (cv < 0.15) return { label: "Low variance", variant: "secondary" };
  if (cv < 0.30) return { label: "Med variance", variant: "secondary" };
  return { label: "High variance", variant: "destructive" };
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
// Internal: ResponseRow
// ---------------------------------------------------------------------------

function ResponseRow({
  response,
  isExpanded,
  onToggle,
  factConfidenceLevel,
}: {
  response: ResponseData;
  isExpanded: boolean;
  onToggle: () => void;
  factConfidenceLevel: string | null;
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

  const truncatedAnswer =
    response.answerText.length > 120
      ? response.answerText.slice(0, 120) + "..."
      : response.answerText;

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
          {response.confidence !== null ? (
            <span
              className={`text-sm font-medium ${
                response.confidence >= 80
                  ? "text-green-600 dark:text-green-400"
                  : response.confidence >= 50
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
              }`}
            >
              {Math.round(response.confidence)}%
            </span>
          ) : (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
          )}
        </TableCell>
        <TableCell className="text-center">
          <SentimentBadge score={response.sentimentScore} />
        </TableCell>
        <TableCell className="text-center">
          <span className="text-sm">{response.citations.length}</span>
        </TableCell>
        <TableCell className="text-center">
          {factConfidenceLevel ? (
            <span
              className={`text-sm font-medium ${
                factConfidenceLevel === "high"
                  ? "text-green-600 dark:text-green-400"
                  : factConfidenceLevel === "medium"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
              }`}
            >
              {factConfidenceLevel.charAt(0).toUpperCase() + factConfidenceLevel.slice(1)}
            </span>
          ) : (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
          )}
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
          <TableCell colSpan={7} className="bg-[hsl(var(--muted))]/30 p-6">
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

              {/* Analysis */}
              <div>
                <h4 className="mb-1 text-sm font-medium">Reliability Analysis</h4>
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

const TITLE_TRUNCATE_LENGTH = 100;

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
    <CardTitle className="text-lg">
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
  agreementMap,
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
              <QuestionTitle
                order={group.questionOrder + 1}
                title={group.questionTitle}
                questionId={group.questionId}
                isExpanded={expandedTitles.has(group.questionId)}
                onToggle={toggleTitle}
              />
              <CardDescription>
                {group.responses.length} model output
                {group.responses.length === 1 ? "" : "s"}
                {formatAvgScore(group.responses)}
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
              {agreement && agreement.factConfidenceLevel && (
                <div className="mt-2">
                  <FactConfidenceCard agreement={agreement} />
                </div>
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
                        <TableHead className="text-center">AI Confidence</TableHead>
                        <TableHead className="text-center">Sentiment</TableHead>
                        <TableHead className="text-center">Citations</TableHead>
                        <TableHead className="text-center">FCA</TableHead>
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
                            factConfidenceLevel={agreement?.factConfidenceLevel ?? null}
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
