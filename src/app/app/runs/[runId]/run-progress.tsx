"use client";

import { useEffect, useState, useRef, useCallback, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cancelRunAction } from "./actions";
import { StatusBadge, StatCard } from "./shared-components";
import { DecisionHeader } from "./decision-header";
import { QuestionResults } from "./question-results";
import type {
  ResponseData,
  QuestionGroup,
  QuestionAgreementData,
} from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunProgressViewProps {
  runId: string;
  initialStatus: string;
  initialAnalysisComplete: boolean;
  surveyTitle: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  responses: ResponseData[];
  questionAgreements?: QuestionAgreementData[];
  completedAt?: string | null;
  modelCount?: number;
  avgLatencyMs?: number | null;
}

const sseEventSchema = z.object({
  runId: z.string(),
  status: z.string(),
  total: z.number(),
  completed: z.number(),
  failed: z.number(),
  running: z.number(),
  progress: z.number(),
  analysisComplete: z.boolean(),
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RunProgressView({
  runId,
  initialStatus,
  initialAnalysisComplete,
  surveyTitle,
  totalJobs: initialTotal,
  completedJobs: initialCompleted,
  failedJobs: initialFailed,
  responses,
  questionAgreements = [],
  completedAt = null,
  modelCount = 0,
  avgLatencyMs = null,
}: RunProgressViewProps): React.JSX.Element {
  const [status, setStatus] = useState(initialStatus);
  const [total, setTotal] = useState(initialTotal);
  const [completed, setCompleted] = useState(initialCompleted);
  const [failed, setFailed] = useState(initialFailed);
  const [running, setRunning] = useState(0);
  const [analysisComplete, setAnalysisComplete] = useState(initialAnalysisComplete);
  const [error, setError] = useState<string | null>(null);

  const [isCancelling, startCancelTransition] = useTransition();

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);
  const questionRefsRef = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const isLive =
    status === "QUEUED" ||
    status === "RUNNING" ||
    (status === "COMPLETED" && !analysisComplete);

  // SSE connection with exponential backoff reconnect (max 3 retries)
  useEffect(() => {
    if (!isLive) return;

    const es = new EventSource(`/api/runs/${runId}/events`);
    eventSourceRef.current = es;

    es.onmessage = (event: MessageEvent) => {
      retryCountRef.current = 0; // reset backoff on successful message
      try {
        const raw: unknown = JSON.parse(event.data as string);
        const result = sseEventSchema.safeParse(raw);
        if (!result.success) return;
        const data = result.data;

        setStatus(data.status);
        setTotal(data.total);
        setCompleted(data.completed);
        setFailed(data.failed);
        setRunning(data.running);
        setAnalysisComplete(data.analysisComplete);

        const runTerminal = data.status === "COMPLETED" || data.status === "FAILED" || data.status === "CANCELLED";
        const fullyDone = runTerminal && (data.analysisComplete || data.status !== "COMPLETED");
        if (fullyDone) {
          es.close();
          eventSourceRef.current = null;
          router.refresh();
          return;
        }
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      if (retryCountRef.current < 3) {
        // Exponential backoff: 3 s, 6 s, 12 s
        const delay = 3000 * Math.pow(2, retryCountRef.current);
        retryCountRef.current++;
        retryTimeoutRef.current = setTimeout(() => {
          setReconnectTrigger((n) => n + 1);
        }, delay);
      }
    };

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId, isLive, router, reconnectTrigger]);

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
  const questionGroups = useMemo(() => {
    const groups: QuestionGroup[] = [];
    const groupMap = new Map<string, QuestionGroup>();
    for (const resp of responses) {
      let group = groupMap.get(resp.questionId);
      if (!group) {
        group = {
          questionId: resp.questionId,
          questionTitle: resp.questionTitle,
          questionPrompt: resp.questionPrompt,
          questionType: resp.questionType,
          questionConfig: resp.questionConfig,
          questionOrder: resp.questionOrder,
          responses: [],
        };
        groupMap.set(resp.questionId, group);
        groups.push(group);
      }
      group.responses.push(resp);
    }
    groups.sort((a, b) => a.questionOrder - b.questionOrder);
    return groups;
  }, [responses]);

  // Build agreement lookup for per-question badges
  const agreementMap = useMemo(() => {
    const map = new Map<string, QuestionAgreementData>();
    for (const a of questionAgreements) {
      map.set(a.questionId, a);
    }
    return map;
  }, [questionAgreements]);

  const progress = total > 0 ? ((completed + failed) / total) * 100 : 0;
  const isTerminal = status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";

  return (
    <div className="space-y-6">
      {/* Error */}
      {error && (
        <div className="rounded-lg border border-[hsl(var(--destructive))]/50 bg-[hsl(var(--destructive))]/10 p-4">
          <p className="text-sm font-medium text-[hsl(var(--destructive))]">
            {error}
          </p>
        </div>
      )}

      {/* --- Live Progress View --- */}
      {!isTerminal && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Decision &amp; Reliability Analysis</h1>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Evaluation: {surveyTitle}
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
            </div>
          </div>

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
        </>
      )}

      {/* --- Decision Dashboard (terminal runs) --- */}
      {isTerminal && responses.length > 0 && (
        <>
          <DecisionHeader
            surveyTitle={surveyTitle}
            completedAt={completedAt}
            modelCount={modelCount}
            totalResponses={responses.length}
            avgLatencyMs={avgLatencyMs}
            totalTokens={responses.reduce((sum, r) => sum + (r.totalTokens ?? 0), 0)}
            totalCostUsd={responses.reduce((sum, r) => sum + (r.costUsd ? parseFloat(r.costUsd) : 0), 0)}
            status={status}
          />

          <QuestionResults
            questionGroups={questionGroups}
            agreementMap={agreementMap}
            expandedRows={expandedRows}
            onToggleRow={toggleRow}
            questionRefs={questionRefsRef}
          />
        </>
      )}

      {/* No responses message */}
      {isTerminal && responses.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-[hsl(var(--muted-foreground))]">
              No model outputs were collected for this run.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
