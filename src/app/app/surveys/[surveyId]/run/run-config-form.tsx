"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { estimateRunAction, startRunAction } from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelTargetData {
  id: string;
  provider: string;
  modelName: string;
  isDefaultCostEffective: boolean;
  inputTokenCostUsd: number;
  outputTokenCostUsd: number;
}

interface VariableData {
  id: string;
  key: string;
  label: string | null;
  defaultValue: string | null;
}

interface ModelEstimate {
  modelTargetId: string;
  modelName: string;
  provider: string;
  jobCount: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
}

interface RunEstimate {
  totalQuestions: number;
  totalModels: number;
  totalJobs: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  estimatedCostUsd: number;
  perModel: ModelEstimate[];
}

interface Limits {
  maxTokensPerRun: number;
  maxCostPerRunUsd: number;
}

interface RunConfigFormProps {
  surveyId: string;
  modelTargets: ModelTargetData[];
  variables: VariableData[];
  questionCount: number;
  limits: Limits;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RunConfigForm({
  surveyId,
  modelTargets,
  variables,
  questionCount,
  limits,
}: RunConfigFormProps) {
  // Model selection state: pre-select cost-effective models
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(
    () =>
      new Set(
        modelTargets
          .filter((mt) => mt.isDefaultCostEffective)
          .map((mt) => mt.id)
      )
  );

  // Variable override state
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // Estimate state
  const [estimate, setEstimate] = useState<RunEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Transition states
  const [isEstimating, startEstimateTransition] = useTransition();
  const [isStarting, startRunTransition] = useTransition();

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  // Auto-estimate helper
  const runEstimate = (modelIds: Set<string>, varOverrides: Record<string, string>) => {
    if (modelIds.size === 0) {
      setEstimate(null);
      return;
    }

    startEstimateTransition(async () => {
      setError(null);
      const formData = new FormData();
      formData.set("modelTargetIds", JSON.stringify(Array.from(modelIds)));
      if (Object.keys(varOverrides).length > 0) {
        formData.set("variableOverrides", JSON.stringify(varOverrides));
      }

      const result = await estimateRunAction(surveyId, formData);
      if (result.success) {
        setEstimate(result.estimate);
      } else {
        setError(result.error);
      }
    });
  };

  // Auto-estimate on initial load
  const hasAutoEstimated = useRef(false);
  useEffect(() => {
    if (!hasAutoEstimated.current && selectedModelIds.size > 0) {
      hasAutoEstimated.current = true;
      runEstimate(selectedModelIds, overrides);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleModel(id: string) {
    setSelectedModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // Re-estimate with new selection
      runEstimate(next, overrides);
      return next;
    });
    setError(null);
  }

  function handleOverrideChange(key: string, value: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value.trim() === "") {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
    setError(null);
  }

  function handleStartRun() {
    if (!estimate) return;

    startRunTransition(async () => {
      setError(null);
      const formData = new FormData();
      formData.set(
        "modelTargetIds",
        JSON.stringify(Array.from(selectedModelIds))
      );
      if (Object.keys(overrides).length > 0) {
        formData.set("variableOverrides", JSON.stringify(overrides));
      }

      const result = await startRunAction(surveyId, formData);
      // If the action succeeds, it redirects. If it returns, there was an error.
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Limit checks
  // ---------------------------------------------------------------------------

  const overTokenLimit =
    estimate !== null && estimate.estimatedTotalTokens > limits.maxTokensPerRun;
  const overCostLimit =
    estimate !== null && estimate.estimatedCostUsd > limits.maxCostPerRunUsd;
  const withinLimits = estimate !== null && !overTokenLimit && !overCostLimit;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Models</CardTitle>
          <CardDescription>
            Choose which AI models to include in this run. Each model will
            receive all {questionCount} question
            {questionCount === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {modelTargets.length === 0 ? (
            <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No models are currently enabled. Ask an admin to configure model
              targets.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modelTargets.map((mt) => {
                const isSelected = selectedModelIds.has(mt.id);
                return (
                  <button
                    key={mt.id}
                    type="button"
                    onClick={() => toggleModel(mt.id)}
                    className={
                      "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors " +
                      (isSelected
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5"
                        : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50")
                    }
                  >
                    <div
                      className={
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border " +
                        (isSelected
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                          : "border-[hsl(var(--border))]")
                      }
                    >
                      {isSelected && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M2 6L5 9L10 3"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{mt.modelName}</span>
                        {mt.isDefaultCostEffective && (
                          <Badge variant="secondary" className="text-[10px]">
                            Cost-effective
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                        {mt.provider}
                      </p>
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        In: ${mt.inputTokenCostUsd.toFixed(2)}/M &middot; Out: $
                        {mt.outputTokenCostUsd.toFixed(2)}/M
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
            {selectedModelIds.size} model
            {selectedModelIds.size === 1 ? "" : "s"} selected
          </p>
        </CardContent>
      </Card>

      {/* Variable Overrides */}
      {variables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Variable Overrides</CardTitle>
            <CardDescription>
              Override default variable values for this run. Leave blank to use
              the default.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {variables.map((v) => (
                <div key={v.id} className="grid grid-cols-3 items-center gap-4">
                  <div>
                    <Label htmlFor={`var-override-${v.key}`}>
                      <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-sm">
                        {v.key}
                      </code>
                    </Label>
                    {v.label && (
                      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                        {v.label}
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    Default:{" "}
                    {v.defaultValue ? (
                      <span className="text-[hsl(var(--foreground))]">
                        {v.defaultValue}
                      </span>
                    ) : (
                      <span className="italic">none</span>
                    )}
                  </div>
                  <Input
                    id={`var-override-${v.key}`}
                    placeholder="Override value"
                    value={overrides[v.key] ?? ""}
                    onChange={(e) =>
                      handleOverrideChange(v.key, e.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleStartRun}
          disabled={!withinLimits || isStarting || isEstimating}
        >
          {isStarting ? "Starting Run..." : isEstimating ? "Estimating..." : "Start Run"}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-[hsl(var(--destructive))]/50 bg-[hsl(var(--destructive))]/10 p-4">
          <p className="text-sm font-medium text-[hsl(var(--destructive))]">
            {error}
          </p>
        </div>
      )}

      {/* Estimate Results */}
      {estimate && (
        <Card>
          <CardHeader>
            <CardTitle>Estimation Results</CardTitle>
            <CardDescription>
              Projected token usage and cost for this run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SummaryCard
                label="Total Jobs"
                value={estimate.totalJobs.toLocaleString()}
              />
              <SummaryCard
                label="Total Tokens"
                value={estimate.estimatedTotalTokens.toLocaleString()}
                warning={overTokenLimit}
                warningText={`Limit: ${limits.maxTokensPerRun.toLocaleString()}`}
              />
              <SummaryCard
                label="Estimated Cost"
                value={`$${estimate.estimatedCostUsd.toFixed(4)}`}
                warning={overCostLimit}
                warningText={`Limit: $${limits.maxCostPerRunUsd.toFixed(2)}`}
              />
              <SummaryCard
                label="Models x Questions"
                value={`${estimate.totalModels} x ${estimate.totalQuestions}`}
              />
            </div>

            {/* Warnings */}
            {(overTokenLimit || overCostLimit) && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  This run exceeds configured limits and cannot be started.
                </p>
                <ul className="mt-2 list-inside list-disc text-sm text-amber-600 dark:text-amber-500">
                  {overTokenLimit && (
                    <li>
                      Token usage ({estimate.estimatedTotalTokens.toLocaleString()}) exceeds limit ({limits.maxTokensPerRun.toLocaleString()})
                    </li>
                  )}
                  {overCostLimit && (
                    <li>
                      Estimated cost ($
                      {estimate.estimatedCostUsd.toFixed(4)}) exceeds limit ($
                      {limits.maxCostPerRunUsd.toFixed(2)})
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Per-model breakdown */}
            <div>
              <h3 className="mb-3 text-sm font-medium">Per-Model Breakdown</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Jobs</TableHead>
                    <TableHead className="text-right">Input Tokens</TableHead>
                    <TableHead className="text-right">Output Tokens</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estimate.perModel.map((m) => (
                    <TableRow key={m.modelTargetId}>
                      <TableCell className="font-medium">
                        {m.modelName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{m.provider}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {m.jobCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {m.estimatedInputTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {m.estimatedOutputTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        ${m.estimatedCostUsd.toFixed(4)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  warning = false,
  warningText,
}: {
  label: string;
  value: string;
  warning?: boolean;
  warningText?: string;
}) {
  return (
    <div
      className={
        "rounded-lg border p-3 " +
        (warning
          ? "border-amber-500/50 bg-amber-500/5"
          : "border-[hsl(var(--border))]")
      }
    >
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p
        className={
          "mt-1 text-lg font-semibold " +
          (warning
            ? "text-amber-700 dark:text-amber-400"
            : "text-[hsl(var(--foreground))]")
        }
      >
        {value}
      </p>
      {warning && warningText && (
        <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-500">
          {warningText}
        </p>
      )}
    </div>
  );
}
