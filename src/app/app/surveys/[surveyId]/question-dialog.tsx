"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { TypeSidebar } from "@/app/app/surveys/[surveyId]/type-sidebar";
import { ConfigRanked } from "@/app/app/surveys/[surveyId]/config-ranked";
import { ConfigSingleSelect } from "@/app/app/surveys/[surveyId]/config-single-select";
import { ConfigBinary } from "@/app/app/surveys/[surveyId]/config-binary";
import { ConfigForcedChoice } from "@/app/app/surveys/[surveyId]/config-forced-choice";
import { ConfigLikert } from "@/app/app/surveys/[surveyId]/config-likert";
import { ConfigNumericScale } from "@/app/app/surveys/[surveyId]/config-numeric-scale";
import { ConfigMatrixLikert } from "@/app/app/surveys/[surveyId]/config-matrix-likert";
import {
  DEFAULT_CONFIGS,
} from "@/app/app/surveys/[surveyId]/question-presets";
import type { QuestionData } from "@/app/app/surveys/[surveyId]/question-presets";
import { addQuestionAction, updateQuestionAction } from "./actions";
import {
  rankedConfigSchema,
  singleSelectConfigSchema,
  binaryConfigSchema,
  forcedChoiceConfigSchema,
  likertConfigSchema,
  numericScaleConfigSchema,
  matrixLikertConfigSchema,
} from "@/lib/schemas";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyId: string;
  existingQuestions: Array<{ threadKey: string | null }>;
  editQuestion?: QuestionData;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateConfig(
  questionType: string,
  config: unknown
): { success: true } | { success: false; error: { issues: Array<{ message: string }> } } {
  switch (questionType) {
    case "RANKED":
      return rankedConfigSchema.safeParse(config);
    case "SINGLE_SELECT":
      return singleSelectConfigSchema.safeParse(config);
    case "BINARY":
      return binaryConfigSchema.safeParse(config);
    case "FORCED_CHOICE":
      return forcedChoiceConfigSchema.safeParse(config);
    case "LIKERT":
      return likertConfigSchema.safeParse(config);
    case "NUMERIC_SCALE":
      return numericScaleConfigSchema.safeParse(config);
    case "MATRIX_LIKERT":
      return matrixLikertConfigSchema.safeParse(config);
    default:
      return { success: true };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuestionDialog({
  open,
  onOpenChange,
  surveyId,
  existingQuestions,
  editQuestion,
}: QuestionDialogProps): React.ReactElement {
  const isEdit = editQuestion !== undefined;

  // ---- state ----
  const [selectedType, setSelectedType] = useState<string>(
    editQuestion?.type ?? "OPEN_ENDED"
  );
  const [promptText, setPromptText] = useState<string>(
    editQuestion?.promptTemplate ?? ""
  );
  const [config, setConfig] = useState<Record<string, unknown>>(
    () => editQuestion?.configJson ?? DEFAULT_CONFIGS[editQuestion?.type ?? "OPEN_ENDED"] ?? {}
  );
  const [configValid, setConfigValid] = useState(true);
  const [mode, setMode] = useState<"STATELESS" | "THREADED">(
    (editQuestion?.mode === "THREADED" ? "THREADED" : "STATELESS")
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Thread key state
  const existingThreadKeys = useMemo(
    () =>
      Array.from(
        new Set(
          existingQuestions
            .filter(
              (q): q is { threadKey: string } =>
                typeof q.threadKey === "string" && q.threadKey !== null
            )
            .map((q) => q.threadKey)
        )
      ),
    [existingQuestions]
  );

  const [creatingNewThread, setCreatingNewThread] = useState(false);
  const [threadKeySelection, setThreadKeySelection] = useState<string>("");
  const [newThreadKey, setNewThreadKey] = useState("");

  function generateThreadKey(): string {
    for (let i = 1; ; i++) {
      const candidate = `thread-${i}`;
      if (!existingThreadKeys.includes(candidate)) return candidate;
    }
  }

  // Reset state when dialog opens with new editQuestion or for add
  useEffect(() => {
    if (!open) return;
    const type = editQuestion?.type ?? "OPEN_ENDED";
    setSelectedType(type);
    setPromptText(editQuestion?.promptTemplate ?? "");
    setConfig(editQuestion?.configJson ?? DEFAULT_CONFIGS[type] ?? {});
    setConfigValid(true);
    setError(null);
    setSubmitting(false);

    const editMode = editQuestion?.mode === "THREADED" ? "THREADED" : "STATELESS";
    setMode(editMode);

    if (editMode === "THREADED" && editQuestion?.threadKey) {
      if (existingThreadKeys.includes(editQuestion.threadKey)) {
        setCreatingNewThread(false);
        setThreadKeySelection(editQuestion.threadKey);
      } else {
        setCreatingNewThread(true);
        setNewThreadKey(editQuestion.threadKey);
      }
    } else {
      setCreatingNewThread(false);
      setThreadKeySelection(
        existingThreadKeys.length > 0
          ? existingThreadKeys[existingThreadKeys.length - 1]
          : ""
      );
      setNewThreadKey("");
    }
  }, [open, editQuestion, existingThreadKeys]);

  // ---- handlers ----

  const handleTypeChange = useCallback(
    (type: string): void => {
      setSelectedType(type);
      setConfig(DEFAULT_CONFIGS[type] ?? {});
      setConfigValid(true);
      setError(null);
    },
    []
  );

  const handleConfigChange = useCallback(
    (nextConfig: Record<string, unknown>, valid: boolean): void => {
      setConfig(nextConfig);
      setConfigValid(valid);
      setError(null);
    },
    []
  );

  const handleModeToggle = useCallback(
    (nextMode: "STATELESS" | "THREADED"): void => {
      setMode(nextMode);
      if (nextMode === "THREADED") {
        if (existingThreadKeys.length > 0) {
          setThreadKeySelection(
            existingThreadKeys[existingThreadKeys.length - 1]
          );
          setCreatingNewThread(false);
        } else {
          setCreatingNewThread(true);
          setNewThreadKey(generateThreadKey());
        }
      }
    },
    // generateThreadKey uses existingThreadKeys which is stable via useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existingThreadKeys]
  );

  const canSubmit =
    promptText.trim().length > 0 && configValid && !submitting;

  const handleSubmit = useCallback(async (): Promise<void> => {
    setError(null);

    // Validate config through the correct Zod schema
    if (selectedType !== "OPEN_ENDED") {
      const result = validateConfig(selectedType, config);
      if (!result.success) {
        setError(
          `Invalid configuration: ${result.error.issues.map((i) => i.message).join(", ")}`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("promptTemplate", promptText.trim());
      formData.set("type", selectedType);
      formData.set("mode", mode);

      if (mode === "THREADED") {
        const threadKey = creatingNewThread ? newThreadKey : threadKeySelection;
        if (threadKey) {
          formData.set("threadKey", threadKey);
        }
      }

      // For RANKED, config is the ranked config (no type field).
      // For benchmark types, config includes the type field.
      // For OPEN_ENDED, don't include configJson.
      if (selectedType !== "OPEN_ENDED") {
        formData.set("configJson", JSON.stringify(config));
      }

      let result: { success: boolean; error?: string };
      if (isEdit && editQuestion) {
        const boundUpdate = updateQuestionAction.bind(
          null,
          surveyId,
          editQuestion.id
        );
        result = await boundUpdate(formData);
      } else {
        const boundAdd = addQuestionAction.bind(null, surveyId);
        result = await boundAdd(formData);
      }

      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error ?? "An unknown error occurred.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedType,
    config,
    promptText,
    mode,
    creatingNewThread,
    newThreadKey,
    threadKeySelection,
    isEdit,
    editQuestion,
    surveyId,
    onOpenChange,
  ]);

  // ---- config panel renderer ----

  function renderConfigPanel(): React.ReactElement {
    switch (selectedType) {
      case "OPEN_ENDED":
        return (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-sm text-center text-sm text-[hsl(var(--muted-foreground))]">
              No configuration required for open-ended questions. The model will
              respond with freeform text.
            </p>
          </div>
        );
      case "RANKED":
        return <ConfigRanked value={config} onChange={handleConfigChange} />;
      case "SINGLE_SELECT":
        return (
          <ConfigSingleSelect value={config} onChange={handleConfigChange} />
        );
      case "BINARY":
        return <ConfigBinary value={config} onChange={handleConfigChange} />;
      case "FORCED_CHOICE":
        return (
          <ConfigForcedChoice value={config} onChange={handleConfigChange} />
        );
      case "LIKERT":
        return <ConfigLikert value={config} onChange={handleConfigChange} />;
      case "NUMERIC_SCALE":
        return (
          <ConfigNumericScale value={config} onChange={handleConfigChange} />
        );
      case "MATRIX_LIKERT":
        return (
          <ConfigMatrixLikert value={config} onChange={handleConfigChange} />
        );
      default:
        return (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Unknown question type.
          </p>
        );
    }
  }

  // ---- render ----

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-7xl h-[85vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-4 pb-0">
          <DialogTitle className="text-sm font-medium">Question:</DialogTitle>
        </DialogHeader>

        {/* Prompt textarea */}
        <div className="border-b px-6 pb-3 pt-2">
          <Textarea
            id="qd-prompt"
            value={promptText}
            onChange={(e) => {
              setPromptText(e.target.value);
              setError(null);
            }}
            placeholder="e.g., What do you think about {{brand}}? Use {{variable_name}} for substitution."
            rows={1}
            className="min-h-0 resize-y"
          />
        </div>

        {/* Middle zone: sidebar + config panel */}
        <div className="flex min-h-0 flex-1">
          <TypeSidebar selectedType={selectedType} onSelect={handleTypeChange} />
          <div
            key={selectedType}
            className="flex-1 overflow-y-auto p-5"
          >
            {renderConfigPanel()}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4">
          {/* Error display */}
          {error !== null && (
            <p className="mb-3 text-sm text-[hsl(var(--destructive))]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between">
            {/* Left side: mode toggle + thread key */}
            <div className="flex items-center gap-3">
              <div className="flex rounded-md border border-[hsl(var(--border))]">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === "STATELESS"
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  } rounded-l-md`}
                  onClick={() => handleModeToggle("STATELESS")}
                >
                  Stateless
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === "THREADED"
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  } rounded-r-md`}
                  onClick={() => handleModeToggle("THREADED")}
                >
                  Threaded
                </button>
              </div>

              {mode === "THREADED" && (
                <div className="flex items-center gap-2">
                  {creatingNewThread ? (
                    <>
                      <Input
                        value={newThreadKey}
                        onChange={(e) => setNewThreadKey(e.target.value)}
                        placeholder="e.g., main-thread"
                        className="h-8 w-40 text-xs"
                      />
                      {existingThreadKeys.length > 0 && (
                        <button
                          type="button"
                          className="text-xs text-[hsl(var(--primary))] hover:underline"
                          onClick={() => {
                            setCreatingNewThread(false);
                            setThreadKeySelection(
                              existingThreadKeys[existingThreadKeys.length - 1]
                            );
                          }}
                        >
                          Use existing
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <select
                        value={threadKeySelection}
                        onChange={(e) => setThreadKeySelection(e.target.value)}
                        className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs"
                      >
                        {existingThreadKeys.map((key) => (
                          <option key={key} value={key}>
                            {key}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="text-xs text-[hsl(var(--primary))] hover:underline"
                        onClick={() => {
                          setCreatingNewThread(true);
                          if (!newThreadKey) setNewThreadKey(generateThreadKey());
                        }}
                      >
                        + New thread
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Right side: Cancel + Submit */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {submitting
                  ? "Saving..."
                  : isEdit
                    ? "Save"
                    : "Add Prompt"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
