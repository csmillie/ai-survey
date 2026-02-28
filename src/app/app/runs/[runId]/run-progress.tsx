"use client";

import { useEffect, useState, useRef, useCallback, useTransition } from "react";
import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cancelRunAction, exportRunAction } from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestMessage {
  role: string;
  content: string;
}

interface UsageData {
  inputTokens: number;
  outputTokens: number;
}

interface ResponseData {
  id: string;
  questionId: string;
  questionTitle: string;
  modelName: string;
  provider: string;
  answerText: string;
  rawText: string;
  requestMessages: RequestMessage[] | null;
  usageJson: UsageData | null;
  citations: Array<{ url: string; title?: string; snippet?: string }>;
  sentimentScore: number | null;
  costUsd: string | null;
  latencyMs: number | null;
  flags: string[];
  brandMentions: string[];
  institutionMentions: string[];
  entities: {
    people: string[];
    places: string[];
    organizations: string[];
  } | null;
}

interface QuestionGroup {
  questionId: string;
  questionTitle: string;
  responses: ResponseData[];
}

interface RunProgressViewProps {
  runId: string;
  initialStatus: string;
  surveyId: string;
  surveyTitle: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  responses: ResponseData[];
  totalCostUsd: number;
}

interface SseEvent {
  runId: string;
  status: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
  progress: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RunProgressView({
  runId,
  initialStatus,
  surveyId,
  surveyTitle,
  totalJobs: initialTotal,
  completedJobs: initialCompleted,
  failedJobs: initialFailed,
  responses,
  totalCostUsd,
}: RunProgressViewProps) {
  const [status, setStatus] = useState(initialStatus);
  const [total, setTotal] = useState(initialTotal);
  const [completed, setCompleted] = useState(initialCompleted);
  const [failed, setFailed] = useState(initialFailed);
  const [running, setRunning] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [isCancelling, startCancelTransition] = useTransition();
  const [isExporting, startExportTransition] = useTransition();

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const eventSourceRef = useRef<EventSource | null>(null);
  const isLive = status === "QUEUED" || status === "RUNNING";

  // SSE connection
  useEffect(() => {
    if (!isLive) return;

    const es = new EventSource(`/api/runs/${runId}/events`);
    eventSourceRef.current = es;

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as SseEvent;
        setStatus(data.status);
        setTotal(data.total);
        setCompleted(data.completed);
        setFailed(data.failed);
        setRunning(data.running);
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId, isLive]);

  // Handlers
  const handleCancel = useCallback(() => {
    startCancelTransition(async () => {
      setError(null);
      const result = await cancelRunAction(runId);
      if (!result.success) {
        setError(result.error);
      } else {
        setStatus("CANCELLED");
      }
    });
  }, [runId]);

  const handleExport = useCallback(() => {
    startExportTransition(async () => {
      setError(null);
      const result = await exportRunAction(runId);
      if (!result.success) {
        setError(result.error);
      }
    });
  }, [runId]);

  const toggleRow = useCallback((responseId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(responseId)) {
        next.delete(responseId);
      } else {
        next.add(responseId);
      }
      return next;
    });
  }, []);

  // Group responses by question
  const questionGroups: QuestionGroup[] = [];
  const groupMap = new Map<string, QuestionGroup>();
  for (const resp of responses) {
    let group = groupMap.get(resp.questionId);
    if (!group) {
      group = {
        questionId: resp.questionId,
        questionTitle: resp.questionTitle,
        responses: [],
      };
      groupMap.set(resp.questionId, group);
      questionGroups.push(group);
    }
    group.responses.push(resp);
  }

  const progress = total > 0 ? ((completed + failed) / total) * 100 : 0;
  const isTerminal = status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Run Results</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Survey: {surveyTitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {isLive && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Cancel Run"}
            </Button>
          )}
          {status === "COMPLETED" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-[hsl(var(--destructive))]/50 bg-[hsl(var(--destructive))]/10 p-4">
          <p className="text-sm font-medium text-[hsl(var(--destructive))]">
            {error}
          </p>
        </div>
      )}

      {/* Progress Section */}
      {!isTerminal && (
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>
              {completed + failed} of {total} jobs completed
              {running > 0 ? ` (${running} running)` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} />
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total" value={total} />
              <StatCard label="Completed" value={completed} variant="success" />
              <StatCard label="Failed" value={failed} variant="error" />
              <StatCard label="Running" value={running} variant="info" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary (for terminal runs with responses) */}
      {isTerminal && responses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SummaryCard
                label="Total Responses"
                value={responses.length.toString()}
              />
              <SummaryCard
                label="Total Cost"
                value={`$${totalCostUsd.toFixed(4)}`}
              />
              <SummaryCard
                label="Avg Cost"
                value={
                  responses.length > 0
                    ? `$${(totalCostUsd / responses.length).toFixed(6)}`
                    : "$0"
                }
              />
              <SummaryCard
                label="Questions"
                value={questionGroups.length.toString()}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results by Question */}
      {isTerminal &&
        questionGroups.map((group) => (
          <Card key={group.questionId}>
            <CardHeader>
              <CardTitle className="text-lg">{group.questionTitle}</CardTitle>
              <CardDescription>
                {group.responses.length} response
                {group.responses.length === 1 ? "" : "s"}
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
                        onToggle={() => toggleRow(resp.id)}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

      {/* No responses message */}
      {isTerminal && responses.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-[hsl(var(--muted-foreground))]">
              No responses were collected for this run.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ResponseRow({
  response,
  isExpanded,
  onToggle,
}: {
  response: ResponseData;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [debugOpen, setDebugOpen] = useState(false);

  const truncatedAnswer =
    response.answerText.length > 120
      ? response.answerText.slice(0, 120) + "..."
      : response.answerText;

  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
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
                setDebugOpen(true);
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
          <p className="truncate text-sm">{truncatedAnswer}</p>
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
              {/* Full answer */}
              <div>
                <h4 className="mb-1 text-sm font-medium">Full Answer</h4>
                <p className="whitespace-pre-wrap text-sm">
                  {response.answerText}
                </p>
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
              {response.usageJson && (
                <span className="ml-2">
                  ({response.usageJson.inputTokens.toLocaleString()} input /{" "}
                  {response.usageJson.outputTokens.toLocaleString()} output tokens)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Request Messages */}
            <div>
              <h4 className="mb-2 text-sm font-semibold">Request Messages</h4>
              {response.requestMessages ? (
                <div className="space-y-3">
                  {response.requestMessages.map((msg, i) => (
                    <div key={i}>
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
                {response.rawText}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
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

function SentimentBadge({ score }: { score: number | null }) {
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

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "success" | "error" | "info";
}) {
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[hsl(var(--foreground))]">
        {value}
      </p>
    </div>
  );
}
