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
import { NeedsReview } from "./needs-review";
import { ModelTrustPanel } from "./model-trust-panel";
import { QuestionResults } from "./question-results";
import type {
  ResponseData,
  QuestionGroup,
  ModelMetricData,
  RecommendationData,
  QuestionAgreementData,
  QuestionTruthData,
  QuestionRefereeData,
} from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunProgressViewProps {
  runId: string;
  initialStatus: string;
  surveyTitle: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  responses: ResponseData[];
  modelMetrics?: ModelMetricData[];
  questionAgreements?: QuestionAgreementData[];
  questionTruths?: QuestionTruthData[];
  questionReferees?: QuestionRefereeData[];
  recommendation?: RecommendationData | null;
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
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RunProgressView({
  runId,
  initialStatus,
  surveyTitle,
  totalJobs: initialTotal,
  completedJobs: initialCompleted,
  failedJobs: initialFailed,
  responses,
  modelMetrics = [],
  questionAgreements = [],
  questionTruths = [],
  questionReferees = [],
  recommendation = null,
  completedAt = null,
  modelCount = 0,
  avgLatencyMs = null,
}: RunProgressViewProps): React.JSX.Element {
  const [status, setStatus] = useState(initialStatus);
  const [total, setTotal] = useState(initialTotal);
  const [completed, setCompleted] = useState(initialCompleted);
  const [failed, setFailed] = useState(initialFailed);
  const [running, setRunning] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [isCancelling, startCancelTransition] = useTransition();

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);
  const questionRefsRef = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const isLive = status === "QUEUED" || status === "RUNNING";

  // SSE connection
  useEffect(() => {
    if (!isLive) return;

    const es = new EventSource(`/api/runs/${runId}/events`);
    eventSourceRef.current = es;

    es.onmessage = (event: MessageEvent) => {
      try {
        const raw: unknown = JSON.parse(event.data as string);
        const result = sseEventSchema.safeParse(raw);
        if (!result.success) return;
        const data = result.data;

        const terminal = data.status === "COMPLETED" || data.status === "FAILED" || data.status === "CANCELLED";
        if (terminal) {
          es.close();
          eventSourceRef.current = null;
          setStatus(data.status);
          router.refresh();
          return;
        }

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
  }, [runId, isLive, router]);

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

  const handleScrollToQuestion = useCallback((questionId: string) => {
    const el = questionRefsRef.current.get(questionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
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

  // Build truth/referee lookups for per-question panels
  const truthMap = useMemo(() => {
    const map = new Map<string, QuestionTruthData>();
    for (const t of questionTruths) {
      map.set(t.questionId, t);
    }
    return map;
  }, [questionTruths]);

  const refereeMap = useMemo(() => {
    const map = new Map<string, QuestionRefereeData>();
    for (const r of questionReferees) {
      map.set(r.questionId, r);
    }
    return map;
  }, [questionReferees]);

  // Build model stats (avg latency + avg cost) keyed by modelTargetId
  const modelStats = useMemo(() => {
    const accum = new Map<string, { totalLatency: number; latencyCount: number; totalCost: number; costCount: number }>();
    const modelTargetLookup = new Map<string, string>();
    for (const m of modelMetrics) {
      modelTargetLookup.set(`${m.modelName}|${m.provider}`, m.modelTargetId);
    }

    for (const resp of responses) {
      const key = `${resp.modelName}|${resp.provider}`;
      const targetId = modelTargetLookup.get(key);
      if (!targetId) continue;

      let entry = accum.get(targetId);
      if (!entry) {
        entry = { totalLatency: 0, latencyCount: 0, totalCost: 0, costCount: 0 };
        accum.set(targetId, entry);
      }
      if (resp.latencyMs !== null) {
        entry.totalLatency += resp.latencyMs;
        entry.latencyCount++;
      }
      if (resp.costUsd !== null) {
        entry.totalCost += parseFloat(resp.costUsd);
        entry.costCount++;
      }
    }

    const result = new Map<string, { avgLatencyMs: number; avgCostUsd: number }>();
    for (const [targetId, entry] of accum) {
      if (entry.latencyCount > 0 || entry.costCount > 0) {
        result.set(targetId, {
          avgLatencyMs: entry.latencyCount > 0 ? entry.totalLatency / entry.latencyCount : 0,
          avgCostUsd: entry.costCount > 0 ? entry.totalCost / entry.costCount : 0,
        });
      }
    }
    return result;
  }, [responses, modelMetrics]);

  const hasMetrics = modelMetrics.length > 0;
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
            recommendation={hasMetrics ? recommendation : null}
            totalResponses={responses.length}
            avgLatencyMs={avgLatencyMs}
            status={status}
          />

          <NeedsReview
            questionAgreements={questionAgreements}
            onScrollToQuestion={handleScrollToQuestion}
          />

          {hasMetrics && (
            <ModelTrustPanel
              modelMetrics={modelMetrics}
              questionAgreements={questionAgreements}
              runId={runId}
              modelStats={modelStats}
              onScrollToQuestion={handleScrollToQuestion}
            />
          )}

          <QuestionResults
            questionGroups={questionGroups}
            agreementMap={agreementMap}
            truthMap={truthMap}
            refereeMap={refereeMap}
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
