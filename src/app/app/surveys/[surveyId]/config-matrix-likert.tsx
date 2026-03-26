"use client";

import { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { BenchmarkOption } from "@/lib/benchmark-types";
import type { ConfigEditorProps } from "@/app/app/surveys/[surveyId]/question-presets";
import { MATRIX_LIKERT_PRESETS, labelToSlug } from "@/app/app/surveys/[surveyId]/question-presets";
import type { MatrixRowData } from "@/app/app/surveys/[surveyId]/question-presets";
import { ConfigJsonEditor } from "@/app/app/surveys/[surveyId]/config-json-editor";
import { OptionRows } from "@/app/app/surveys/[surveyId]/option-rows";

// ---------------------------------------------------------------------------
// Extended props — matrix likert also manages rows
// ---------------------------------------------------------------------------

interface ConfigMatrixLikertProps extends ConfigEditorProps {
  matrixRows?: MatrixRowData[];
  onMatrixRowsChange?: (rows: MatrixRowData[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractOptions(value: Record<string, unknown>): BenchmarkOption[] {
  const raw = value.options;
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is BenchmarkOption =>
        typeof item === "object" &&
        item !== null &&
        "label" in item &&
        "value" in item &&
        typeof (item as Record<string, unknown>).label === "string" &&
        typeof (item as Record<string, unknown>).value === "string"
    );
  }
  return MATRIX_LIKERT_PRESETS[0].options;
}

function findMatchingPreset(options: BenchmarkOption[]): string | null {
  for (const preset of MATRIX_LIKERT_PRESETS) {
    if (preset.options.length !== options.length) continue;
    const match = preset.options.every(
      (p, i) => p.value === options[i]?.value
    );
    if (match) return preset.key;
  }
  return null;
}

function isValid(stem: string, options: BenchmarkOption[]): boolean {
  return (
    stem.trim() !== "" &&
    options.length >= 2 &&
    options.every((opt) => opt.label.trim() !== "" && opt.value.trim() !== "")
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfigMatrixLikert({
  value,
  onChange,
  matrixRows: initialRows = [],
  onMatrixRowsChange,
}: ConfigMatrixLikertProps): React.ReactElement {
  const [stem, setStem] = useState<string>(
    () => typeof value.stem === "string" ? value.stem : "Rate the following items:"
  );
  const [options, setOptions] = useState<BenchmarkOption[]>(() => extractOptions(value));
  const [selectedPreset, setSelectedPreset] = useState<string | null>(
    () => findMatchingPreset(extractOptions(value))
  );
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const userEdited = useRef(false);

  // Matrix rows state
  const [rows, setRows] = useState<MatrixRowData[]>(initialRows);

  const emit = useCallback(
    (nextStem: string, nextOptions: BenchmarkOption[]): void => {
      const config: Record<string, unknown> = {
        type: "MATRIX_LIKERT",
        stem: nextStem,
        options: nextOptions,
      };
      onChange(config, isValid(nextStem, nextOptions));
    },
    [onChange],
  );

  const applyPreset = useCallback(
    (presetKey: string): void => {
      const preset = MATRIX_LIKERT_PRESETS.find((p) => p.key === presetKey);
      if (!preset) return;
      setOptions(preset.options);
      setSelectedPreset(presetKey);
      setPendingPreset(null);
      userEdited.current = false;
      emit(stem, preset.options);
    },
    [stem, emit],
  );

  const handlePresetClick = useCallback(
    (presetKey: string): void => {
      if (userEdited.current) {
        setPendingPreset(presetKey);
      } else {
        applyPreset(presetKey);
      }
    },
    [applyPreset],
  );

  const handleCustomClick = useCallback((): void => {
    setSelectedPreset(null);
    setPendingPreset(null);
  }, []);

  const handleStemChange = useCallback(
    (nextStem: string): void => {
      setStem(nextStem);
      emit(nextStem, options);
    },
    [options, emit],
  );

  const handleOptionsChange = useCallback(
    (nextOptions: BenchmarkOption[]): void => {
      userEdited.current = true;
      setOptions(nextOptions);
      setSelectedPreset(findMatchingPreset(nextOptions));
      emit(stem, nextOptions);
    },
    [stem, emit],
  );

  // --- Matrix rows handlers ---

  const handleRowLabelChange = useCallback(
    (index: number, label: string): void => {
      const updated = rows.map((r, i) =>
        i === index ? { ...r, label, rowKey: labelToSlug(label) } : r
      );
      setRows(updated);
      onMatrixRowsChange?.(updated);
    },
    [rows, onMatrixRowsChange],
  );

  const handleAddRow = useCallback((): void => {
    const newRow: MatrixRowData = {
      id: `new-${Date.now()}`,
      rowKey: "",
      label: "",
      order: rows.length,
    };
    const updated = [...rows, newRow];
    setRows(updated);
    onMatrixRowsChange?.(updated);
  }, [rows, onMatrixRowsChange]);

  const handleRemoveRow = useCallback(
    (index: number): void => {
      const updated = rows
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, order: i }));
      setRows(updated);
      onMatrixRowsChange?.(updated);
    },
    [rows, onMatrixRowsChange],
  );

  return (
    <ConfigJsonEditor
      config={{ type: "MATRIX_LIKERT", stem, options }}
      questionType="MATRIX_LIKERT"
      onConfigChange={onChange}
    >
      <div className="space-y-5">
        {/* Stem input */}
        <div>
          <Label htmlFor="matrix-likert-stem" className="mb-2 block">Stem</Label>
          <Input
            id="matrix-likert-stem"
            value={stem}
            onChange={(e) => handleStemChange(e.target.value)}
            placeholder="Rate the following items:"
          />
        </div>

        {/* Column preset pills */}
        <div>
          <Label className="mb-2 block">Scale Columns</Label>
          <div role="radiogroup" aria-label="Matrix column preset" className="flex flex-wrap gap-2">
            {MATRIX_LIKERT_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                role="radio"
                aria-checked={selectedPreset === preset.key}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  selectedPreset === preset.key
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]"
                }`}
                onClick={() => handlePresetClick(preset.key)}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={selectedPreset === null}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                selectedPreset === null
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]"
              }`}
              onClick={handleCustomClick}
            >
              Custom
            </button>
          </div>

          {pendingPreset !== null && (
            <div className="mt-2 flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
              <span>Replace current options with preset?</span>
              <button
                type="button"
                className="font-medium text-[hsl(var(--primary))] underline"
                onClick={() => applyPreset(pendingPreset)}
              >
                Yes
              </button>
              <button
                type="button"
                className="font-medium underline"
                onClick={() => setPendingPreset(null)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Column option rows */}
        <div>
          <OptionRows options={options} onChange={handleOptionsChange} minRows={2} />
        </div>

        {/* Matrix Rows */}
        <div>
          <Label className="mb-2 block">Rows</Label>
          <p className="mb-2 text-xs text-[hsl(var(--muted-foreground))]">
            Each row will be rated on the scale above. One API call per row per model.
          </p>
          <div className="rounded-md border border-[hsl(var(--border))]">
            {/* Header */}
            <div className="grid grid-cols-[1fr_36px] gap-2 px-3 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
              <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Row Label
              </div>
              <div />
            </div>

            {/* Row items */}
            {rows.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                No rows yet. Add rows to define what items will be rated.
              </div>
            )}
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-[1fr_36px] gap-2 px-3 py-1.5 items-center border-b border-[hsl(var(--border))] last:border-b-0"
              >
                <Input
                  value={row.label}
                  onChange={(e) => handleRowLabelChange(index, e.target.value)}
                  placeholder={`e.g., Trust in ${index === 0 ? "Congress" : index === 1 ? "the Supreme Court" : "the Press"}`}
                  className="h-8 text-sm"
                  aria-label={`Row ${index + 1} label`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[hsl(var(--destructive))]"
                  onClick={() => handleRemoveRow(index)}
                  aria-label={`Remove row ${index + 1}`}
                >
                  <span aria-hidden="true" className="text-xs">✕</span>
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="mt-2 text-sm"
            onClick={handleAddRow}
          >
            + Add row
          </Button>
        </div>
      </div>
    </ConfigJsonEditor>
  );
}
