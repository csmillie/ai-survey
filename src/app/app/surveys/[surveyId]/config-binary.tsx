"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfigJsonEditor } from "@/app/app/surveys/[surveyId]/config-json-editor";
import { BINARY_PRESETS, labelToSlug } from "@/app/app/surveys/[surveyId]/question-presets";
import type { ConfigEditorProps } from "@/app/app/surveys/[surveyId]/question-presets";
import type { BenchmarkOption } from "@/lib/benchmark-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function optionsFromConfig(config: Record<string, unknown>): [BenchmarkOption, BenchmarkOption] {
  const raw = config.options;
  if (Array.isArray(raw) && raw.length === 2) {
    const a = raw[0] as Record<string, unknown>;
    const b = raw[1] as Record<string, unknown>;
    return [
      { label: String(a.label ?? ""), value: String(a.value ?? ""), numericValue: Number(a.numericValue ?? 1) },
      { label: String(b.label ?? ""), value: String(b.value ?? ""), numericValue: Number(b.numericValue ?? 0) },
    ];
  }
  return BINARY_PRESETS[0].options;
}

function detectPreset(options: [BenchmarkOption, BenchmarkOption]): string {
  for (const preset of BINARY_PRESETS) {
    if (
      preset.options[0].label === options[0].label &&
      preset.options[0].value === options[0].value &&
      preset.options[1].label === options[1].label &&
      preset.options[1].value === options[1].value
    ) {
      return preset.key;
    }
  }
  return "custom";
}

// ---------------------------------------------------------------------------
// ConfigBinary
// ---------------------------------------------------------------------------

export function ConfigBinary({ value, onChange }: ConfigEditorProps): React.ReactElement {
  const [options, setOptions] = useState<[BenchmarkOption, BenchmarkOption]>(() => optionsFromConfig(value));
  const [selectedPreset, setSelectedPreset] = useState<string>(() => detectPreset(optionsFromConfig(value)));
  const [reverseScored, setReverseScored] = useState<boolean>(() => Boolean(value.reverseScored));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const userEdited = useRef(false);

  // Emit config on every change
  useEffect(() => {
    const config: Record<string, unknown> = {
      type: "BINARY",
      options,
      reverseScored,
    };
    // Binary is always valid when we have 2 options with labels
    const valid = options[0].label.trim().length > 0 && options[1].label.trim().length > 0;
    onChange(config, valid);
  }, [options, reverseScored, onChange]);

  const applyPreset = useCallback((presetKey: string): void => {
    const preset = BINARY_PRESETS.find((p) => p.key === presetKey);
    if (preset) {
      setOptions([{ ...preset.options[0] }, { ...preset.options[1] }]);
      setSelectedPreset(presetKey);
      setEditingIndex(null);
      userEdited.current = false;
      setPendingPreset(null);
    }
  }, []);

  const handlePresetClick = useCallback(
    (presetKey: string): void => {
      if (presetKey === "custom") {
        setSelectedPreset("custom");
        setPendingPreset(null);
        return;
      }
      if (userEdited.current) {
        setPendingPreset(presetKey);
      } else {
        applyPreset(presetKey);
      }
    },
    [applyPreset],
  );

  const handleConfirmReplace = useCallback((): void => {
    if (pendingPreset !== null) {
      applyPreset(pendingPreset);
    }
  }, [pendingPreset, applyPreset]);

  const handleCancelReplace = useCallback((): void => {
    setPendingPreset(null);
  }, []);

  const updateOption = useCallback(
    (index: 0 | 1, field: keyof BenchmarkOption, val: string | number): void => {
      setOptions((prev) => {
        const updated = [{ ...prev[0] }, { ...prev[1] }] as [BenchmarkOption, BenchmarkOption];
        if (field === "label") {
          updated[index] = { ...updated[index], label: String(val), value: labelToSlug(String(val)) };
        } else if (field === "value") {
          updated[index] = { ...updated[index], value: String(val) };
        } else if (field === "numericValue") {
          updated[index] = { ...updated[index], numericValue: Number(val) };
        }
        return updated;
      });
      userEdited.current = true;
      setSelectedPreset("custom");
    },
    [],
  );

  const handleConfigChange = useCallback(
    (config: Record<string, unknown>, valid: boolean): void => {
      // When coming back from JSON editor, re-parse
      const newOptions = optionsFromConfig(config);
      setOptions(newOptions);
      setSelectedPreset(detectPreset(newOptions));
      setReverseScored(Boolean(config.reverseScored));
      onChange(config, valid);
    },
    [onChange],
  );

  const currentConfig: Record<string, unknown> = {
    type: "BINARY",
    options,
    reverseScored,
  };

  const allPresets = [
    ...BINARY_PRESETS.map((p) => ({ key: p.key, label: p.label })),
    { key: "custom", label: "Custom" },
  ];

  return (
    <ConfigJsonEditor config={currentConfig} questionType="BINARY" onConfigChange={handleConfigChange}>
      <div className="space-y-4 pt-2">
        {/* Preset pills */}
        <div>
          <Label className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Preset</Label>
          <div role="radiogroup" aria-label="Binary presets" className="mt-1.5 flex flex-wrap gap-2">
            {allPresets.map((preset) => (
              <button
                key={preset.key}
                role="radio"
                type="button"
                aria-checked={selectedPreset === preset.key}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  selectedPreset === preset.key
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
                }`}
                onClick={() => handlePresetClick(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {pendingPreset !== null && (
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              Replace current options with preset?{" "}
              <button type="button" className="underline font-medium text-[hsl(var(--primary))]" onClick={handleConfirmReplace}>
                Yes
              </button>
              {" / "}
              <button type="button" className="underline font-medium" onClick={handleCancelReplace}>
                No
              </button>
            </p>
          )}
        </div>

        {/* Two option cards */}
        <div className="grid grid-cols-2 gap-4">
          {([0, 1] as const).map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setEditingIndex(idx)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                editingIndex === idx
                  ? "border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--ring))]"
                  : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]"
              }`}
              aria-label={`Option ${idx + 1}: ${options[idx].label}`}
            >
              {editingIndex === idx ? (
                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={options[idx].label}
                      onChange={(e) => updateOption(idx, "label", e.target.value)}
                      className="mt-1"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Value</Label>
                    <Input
                      value={options[idx].value}
                      onChange={(e) => updateOption(idx, "value", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Score</Label>
                    <Input
                      type="number"
                      value={options[idx].numericValue ?? 0}
                      onChange={(e) => updateOption(idx, "numericValue", Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-lg font-semibold">{options[idx].label || "Untitled"}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Value: {options[idx].value || "—"}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Score: {options[idx].numericValue ?? 0}
                  </p>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Reverse scored */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={reverseScored}
            onChange={(e) => setReverseScored(e.target.checked)}
            className="h-4 w-4 rounded border-[hsl(var(--input))]"
          />
          Reverse scored
        </label>
      </div>
    </ConfigJsonEditor>
  );
}
