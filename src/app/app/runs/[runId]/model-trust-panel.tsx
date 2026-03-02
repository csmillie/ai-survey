"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
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
import { ScoreBar, AgreementBadge, PenaltyItem, ModelLabel } from "./shared-components";
import { POOR_CALIBRATION_SCORE_THRESHOLD } from "@/lib/analysis/calibration";
import type { ModelMetricData, QuestionAgreementData } from "./types";

const DriftChart = dynamic(() => import("./drift-chart").then((m) => m.DriftChart), {
  ssr: false,
  loading: () => (
    <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
      Loading chart...
    </p>
  ),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelTrustPanelProps {
  modelMetrics: ModelMetricData[];
  questionAgreements: QuestionAgreementData[];
  runId: string;
  modelStats?: Map<string, { avgLatencyMs: number; avgCostUsd: number }>;
}

// ---------------------------------------------------------------------------
// Internal: CalibrationWarning
// ---------------------------------------------------------------------------

function CalibrationWarning({
  modelMetrics,
  questionAgreements,
}: {
  modelMetrics: ModelMetricData[];
  questionAgreements: QuestionAgreementData[];
}): React.JSX.Element | null {
  const poorCalibration = modelMetrics.filter(
    (m): m is ModelMetricData & { calibrationScore: number } =>
      m.calibrationScore !== null && m.calibrationScore < POOR_CALIBRATION_SCORE_THRESHOLD
  );

  if (poorCalibration.length === 0) return null;

  const questionsWithOverconfidence = questionAgreements.filter(
    (q) => q.overconfidentModels.length > 0
  );

  return (
    <CardDescription className="mt-1 text-amber-600 dark:text-amber-400">
      {poorCalibration.map((m) => {
        const count = questionsWithOverconfidence.filter((q) =>
          q.overconfidentModels.includes(m.modelName)
        ).length;
        return count > 0
          ? `${m.modelName} overconfident on ${count} prompt${count === 1 ? "" : "s"}`
          : `${m.modelName} poorly calibrated (${m.calibrationScore.toFixed(1)}/10)`;
      }).join(". ")}
    </CardDescription>
  );
}

// ---------------------------------------------------------------------------
// Internal: ReliabilityRow
// ---------------------------------------------------------------------------

function ReliabilityRow({
  metric,
  stats,
}: {
  metric: ModelMetricData;
  stats?: { avgLatencyMs: number; avgCostUsd: number };
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = (): void => setExpanded(!expanded);

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={handleToggle}
      >
        <TableCell>
          <ModelLabel modelName={metric.modelName} provider={metric.provider} />
        </TableCell>
        <TableCell>
          <ScoreBar score={metric.reliabilityScore} min={0} max={10} />
        </TableCell>
        <TableCell className="text-center text-sm">
          {Math.round(metric.jsonValidRate * 100)}%
        </TableCell>
        <TableCell className="text-center text-sm">
          {Math.round(metric.emptyAnswerRate * 100)}% / {Math.round(metric.shortAnswerRate * 100)}%
        </TableCell>
        <TableCell className="text-center text-sm">
          {Math.round(metric.citationRate * 100)}%
        </TableCell>
        <TableCell className="text-center">
          {metric.calibrationScore !== null ? (
            <ScoreBar score={parseFloat(metric.calibrationScore.toFixed(1))} min={0} max={10} />
          ) : (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
          )}
        </TableCell>
        <TableCell className="text-right text-sm">
          {stats ? `${Math.round(stats.avgLatencyMs)}ms` : "-"}
        </TableCell>
        <TableCell className="text-right text-sm">
          {stats ? `$${stats.avgCostUsd.toFixed(6)}` : "-"}
        </TableCell>
        <TableCell className="text-right text-sm">
          {metric.totalResponses}
        </TableCell>
        <TableCell className="text-right">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${metric.modelName} — ${expanded ? "hide" : "show"} penalty breakdown`}
            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            {expanded ? "Hide" : "Details"}
          </button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={10} className="bg-[hsl(var(--muted))]/30 px-6 py-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Penalty Breakdown</h4>
              <div className="grid grid-cols-3 gap-3 text-sm sm:grid-cols-6">
                <PenaltyItem label="Invalid JSON" value={metric.penaltyBreakdown.jsonInvalid} max={6} />
                <PenaltyItem label="Empty Answer" value={metric.penaltyBreakdown.emptyAnswer} max={3} />
                <PenaltyItem label="Short Answer" value={metric.penaltyBreakdown.shortAnswer} max={2} />
                <PenaltyItem label="No Citations" value={metric.penaltyBreakdown.missingCitations} max={2} />
                <PenaltyItem label="Latency Var." value={metric.penaltyBreakdown.latencyVariance} max={1} />
                <PenaltyItem label="Cost Var." value={metric.penaltyBreakdown.costVariance} max={1} />
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ModelTrustPanel
// ---------------------------------------------------------------------------

export function ModelTrustPanel({
  modelMetrics,
  questionAgreements,
  runId,
  modelStats,
}: ModelTrustPanelProps): React.JSX.Element {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const toggleQuestion = useCallback((questionId: string) => {
    setExpandedQuestions((prev) => {
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
    <Card>
      <CardHeader>
        <CardTitle>ModelTrust</CardTitle>
        <CardDescription>
          Model reliability, cross-model agreement, and performance trends
        </CardDescription>
        <CalibrationWarning
          modelMetrics={modelMetrics}
          questionAgreements={questionAgreements}
        />
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="reliability">
          <TabsList>
            <TabsTrigger value="reliability">Reliability</TabsTrigger>
            <TabsTrigger value="agreement">Agreement</TabsTrigger>
            <TabsTrigger value="drift">Drift</TabsTrigger>
          </TabsList>

          <TabsContent value="reliability">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-center">JSON Valid</TableHead>
                  <TableHead className="text-center">Empty / Short</TableHead>
                  <TableHead className="text-center">Citations</TableHead>
                  <TableHead className="text-center">Calibration</TableHead>
                  <TableHead className="text-right">Avg Latency</TableHead>
                  <TableHead className="text-right">Avg Cost</TableHead>
                  <TableHead className="text-right">Outputs</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelMetrics.map((m) => (
                  <ReliabilityRow
                    key={m.modelTargetId}
                    metric={m}
                    stats={modelStats?.get(m.modelTargetId)}
                  />
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="agreement">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Agreement</TableHead>
                  <TableHead>Models</TableHead>
                  <TableHead className="text-center">Overconfidence</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questionAgreements.map((a) => {
                  const outlierSet = new Set(a.outlierModels);
                  return (
                    <TableRow key={a.questionId}>
                      <TableCell className="max-w-md font-medium">
                        <span className="text-[hsl(var(--muted-foreground))]">
                          Q{a.questionOrder + 1}:
                        </span>{" "}
                        {a.questionTitle.length > 100 ? (
                          <>
                            {expandedQuestions.has(a.questionId)
                              ? a.questionTitle
                              : a.questionTitle.slice(0, 100) + "…"}
                            <button
                              type="button"
                              aria-expanded={expandedQuestions.has(a.questionId)}
                              aria-label={`${expandedQuestions.has(a.questionId) ? "Collapse" : "Expand"} question ${a.questionOrder + 1}`}
                              onClick={() => toggleQuestion(a.questionId)}
                              className="ml-1 text-xs font-normal text-[hsl(var(--primary))] hover:underline"
                            >
                              {expandedQuestions.has(a.questionId) ? "show less" : "show more"}
                            </button>
                          </>
                        ) : (
                          a.questionTitle
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AgreementBadge percent={a.agreementPercent} />
                          <span className="text-sm">
                            {Math.round(a.agreementPercent * 100)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {modelMetrics.map((m) => {
                            // When outlierModels is empty but agreement < 100%,
                            // all clusters tied for largest — no consensus exists.
                            const noConsensus =
                              outlierSet.size === 0 && a.agreementPercent < 1.0;
                            const disagrees =
                              noConsensus || outlierSet.has(m.modelName);
                            return (
                              <Badge
                                key={m.modelTargetId}
                                variant={disagrees ? "destructive" : "secondary"}
                                className="text-xs"
                                title={`${m.modelName} (${m.provider})${disagrees ? " — disagrees" : " — agrees"}`}
                              >
                                {disagrees ? "✗" : "✓"} {m.modelName}
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {a.overconfidentModels.length > 0 ? (
                          <Badge variant="destructive">
                            {a.overconfidentModels.length} overconfident
                          </Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {a.humanReviewFlag ? (
                          <Badge variant="destructive">Needs Review</Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="drift">
            <DriftChart runId={runId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
