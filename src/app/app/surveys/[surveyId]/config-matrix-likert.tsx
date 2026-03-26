"use client";

import { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BenchmarkOption } from "@/lib/benchmark-types";
import type { ConfigEditorProps } from "@/app/app/surveys/[surveyId]/question-presets";
import { MATRIX_LIKERT_PRESETS } from "@/app/app/surveys/[surveyId]/question-presets";
import { ConfigJsonEditor } from "@/app/app/surveys/[surveyId]/config-json-editor";
import { OptionRows } from "@/app/app/surveys/[surveyId]/option-rows";

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

export function ConfigMatrixLikert({ value, onChange }: ConfigEditorProps): React.ReactElement {
  const [stem, setStem] = useState<string>(
    () => typeof value.stem === "string" ? value.stem : "Rate the following items:"
  );
  const [options, setOptions] = useState<BenchmarkOption[]>(() => extractOptions(value));
  const [selectedPreset, setSelectedPreset] = useState<string | null>(
    () => findMatchingPreset(extractOptions(value))
  );
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const userEdited = useRef(false);

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
          <Label className="mb-2 block">Column Preset</Label>
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

          {/* Inline confirmation when user has edited and clicks a preset */}
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
          <Label className="mb-2 block">Scale Columns</Label>
          <OptionRows options={options} onChange={handleOptionsChange} minRows={2} />
        </div>

        {/* Info note */}
        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
          Matrix rows are defined by the question template. Each row gets the same scale columns.
        </div>
      </div>
    </ConfigJsonEditor>
  );
}
