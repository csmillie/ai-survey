"use client";

import { useCallback, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import type { BenchmarkOption } from "@/lib/benchmark-types";
import type { ConfigEditorProps } from "@/app/app/surveys/[surveyId]/question-presets";
import { LIKERT_PRESETS } from "@/app/app/surveys/[surveyId]/question-presets";
import { ConfigJsonEditor } from "@/app/app/surveys/[surveyId]/config-json-editor";
import { OptionRows } from "@/app/app/surveys/[surveyId]/option-rows";

const VALID_POINT_COUNTS = new Set([4, 5, 7]);

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
  return LIKERT_PRESETS[0].options;
}

function findMatchingPreset(options: BenchmarkOption[]): string | null {
  for (const preset of LIKERT_PRESETS) {
    if (preset.options.length !== options.length) continue;
    const match = preset.options.every(
      (p, i) => p.value === options[i]?.value
    );
    if (match) return preset.key;
  }
  return null;
}

function isValid(options: BenchmarkOption[]): boolean {
  return VALID_POINT_COUNTS.has(options.length);
}

export function ConfigLikert({ value, onChange }: ConfigEditorProps): React.ReactElement {
  const [options, setOptions] = useState<BenchmarkOption[]>(() => extractOptions(value));
  const [reverseScored, setReverseScored] = useState<boolean>(
    () => typeof value.reverseScored === "boolean" ? value.reverseScored : false
  );
  const [selectedPreset, setSelectedPreset] = useState<string | null>(
    () => findMatchingPreset(extractOptions(value))
  );
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const userEdited = useRef(false);

  const emit = useCallback(
    (nextOptions: BenchmarkOption[], nextReverseScored: boolean): void => {
      const config: Record<string, unknown> = {
        type: "LIKERT",
        points: nextOptions.length,
        options: nextOptions,
        reverseScored: nextReverseScored,
      };
      onChange(config, isValid(nextOptions));
    },
    [onChange],
  );

  const applyPreset = useCallback(
    (presetKey: string): void => {
      const preset = LIKERT_PRESETS.find((p) => p.key === presetKey);
      if (!preset) return;
      setOptions(preset.options);
      setSelectedPreset(presetKey);
      setPendingPreset(null);
      userEdited.current = false;
      emit(preset.options, reverseScored);
    },
    [reverseScored, emit],
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

  const handleOptionsChange = useCallback(
    (nextOptions: BenchmarkOption[]): void => {
      userEdited.current = true;
      setOptions(nextOptions);
      setSelectedPreset(findMatchingPreset(nextOptions));
      emit(nextOptions, reverseScored);
    },
    [reverseScored, emit],
  );

  const handleReverseScoredChange = useCallback(
    (checked: boolean): void => {
      setReverseScored(checked);
      emit(options, checked);
    },
    [options, emit],
  );

  return (
    <ConfigJsonEditor
      config={{ type: "LIKERT", points: options.length, options, reverseScored }}
      questionType="LIKERT"
      onConfigChange={onChange}
    >
      <div className="space-y-5">
        {/* Preset pills */}
        <div>
          <Label className="mb-2 block">Scale Preset</Label>
          <div role="radiogroup" aria-label="Likert scale preset" className="flex flex-wrap gap-2">
            {LIKERT_PRESETS.map((preset) => (
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

        {/* Option rows */}
        <div>
          <Label className="mb-2 block">Options</Label>
          <OptionRows options={options} onChange={handleOptionsChange} />
        </div>

        {/* Validation hint */}
        {!isValid(options) && options.length > 0 && (
          <p className="text-xs text-[hsl(var(--destructive))]">
            Likert scales must have exactly 4, 5, or 7 options.
          </p>
        )}

        {/* Reverse scored checkbox */}
        <div className="flex items-center gap-2">
          <input
            id="likert-reverse-scored"
            type="checkbox"
            checked={reverseScored}
            onChange={(e) => handleReverseScoredChange(e.target.checked)}
            className="h-4 w-4 rounded border-[hsl(var(--border))]"
          />
          <Label htmlFor="likert-reverse-scored">Reverse scored</Label>
        </div>
      </div>
    </ConfigJsonEditor>
  );
}
