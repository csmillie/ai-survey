"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfigJsonEditor } from "@/app/app/surveys/[surveyId]/config-json-editor";
import { labelToSlug } from "@/app/app/surveys/[surveyId]/question-presets";
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
  return [
    { label: "Position A", value: "a", numericValue: 1 },
    { label: "Position B", value: "b", numericValue: 0 },
  ];
}

// ---------------------------------------------------------------------------
// ConfigForcedChoice
// ---------------------------------------------------------------------------

export function ConfigForcedChoice({ value, onChange }: ConfigEditorProps): React.ReactElement {
  const [options, setOptions] = useState<[BenchmarkOption, BenchmarkOption]>(() => optionsFromConfig(value));
  const [poleALabel, setPoleALabel] = useState<string>(() => String(value.poleALabel ?? ""));
  const [poleBLabel, setPoleBLabel] = useState<string>(() => String(value.poleBLabel ?? ""));

  // Emit config on every change
  useEffect(() => {
    const config: Record<string, unknown> = {
      type: "FORCED_CHOICE",
      options,
      poleALabel,
      poleBLabel,
    };
    const valid = options[0].label.trim().length > 0 && options[1].label.trim().length > 0;
    onChange(config, valid);
  }, [options, poleALabel, poleBLabel, onChange]);

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
    },
    [],
  );

  const handleConfigChange = useCallback(
    (config: Record<string, unknown>, valid: boolean): void => {
      const newOptions = optionsFromConfig(config);
      setOptions(newOptions);
      setPoleALabel(String(config.poleALabel ?? ""));
      setPoleBLabel(String(config.poleBLabel ?? ""));
      onChange(config, valid);
    },
    [onChange],
  );

  const currentConfig: Record<string, unknown> = {
    type: "FORCED_CHOICE",
    options,
    poleALabel,
    poleBLabel,
  };

  return (
    <ConfigJsonEditor config={currentConfig} questionType="FORCED_CHOICE" onConfigChange={handleConfigChange}>
      <div className="space-y-4 pt-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
          {/* Pole A */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Pole A Label</Label>
              <Input
                value={poleALabel}
                onChange={(e) => setPoleALabel(e.target.value)}
                placeholder="e.g. Individualism"
                className="mt-1"
              />
            </div>
            <div className="rounded-lg border border-[hsl(var(--border))] p-4 space-y-3">
              <div>
                <Label className="text-xs">Label</Label>
                <Input
                  value={options[0].label}
                  onChange={(e) => updateOption(0, "label", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Value</Label>
                <Input
                  value={options[0].value}
                  onChange={(e) => updateOption(0, "value", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Score</Label>
                <Input
                  type="number"
                  value={options[0].numericValue ?? 0}
                  onChange={(e) => updateOption(0, "numericValue", Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* VS divider */}
          <div className="flex items-center justify-center pt-10">
            <span className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase">vs</span>
          </div>

          {/* Pole B */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Pole B Label</Label>
              <Input
                value={poleBLabel}
                onChange={(e) => setPoleBLabel(e.target.value)}
                placeholder="e.g. Collectivism"
                className="mt-1"
              />
            </div>
            <div className="rounded-lg border border-[hsl(var(--border))] p-4 space-y-3">
              <div>
                <Label className="text-xs">Label</Label>
                <Input
                  value={options[1].label}
                  onChange={(e) => updateOption(1, "label", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Value</Label>
                <Input
                  value={options[1].value}
                  onChange={(e) => updateOption(1, "value", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Score</Label>
                <Input
                  type="number"
                  value={options[1].numericValue ?? 0}
                  onChange={(e) => updateOption(1, "numericValue", Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ConfigJsonEditor>
  );
}
