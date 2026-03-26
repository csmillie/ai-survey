"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfigJsonEditor } from "@/app/app/surveys/[surveyId]/config-json-editor";
import type { ConfigEditorProps } from "@/app/app/surveys/[surveyId]/question-presets";

export function ConfigNumericScale({ value, onChange }: ConfigEditorProps): React.ReactElement {
  const min = typeof value.min === "number" ? value.min : 0;
  const max = typeof value.max === "number" ? value.max : 10;
  const minLabel = typeof value.minLabel === "string" ? value.minLabel : "";
  const maxLabel = typeof value.maxLabel === "string" ? value.maxLabel : "";

  const emit = useCallback(
    (patch: Partial<{ min: number; max: number; minLabel: string; maxLabel: string }>): void => {
      const next = {
        type: "NUMERIC_SCALE" as const,
        min: patch.min ?? min,
        max: patch.max ?? max,
        minLabel: patch.minLabel ?? minLabel,
        maxLabel: patch.maxLabel ?? maxLabel,
      };
      onChange(next, next.min < next.max);
    },
    [min, max, minLabel, maxLabel, onChange],
  );

  return (
    <ConfigJsonEditor config={value} questionType="NUMERIC_SCALE" onConfigChange={onChange}>
      <div className="space-y-5 pr-24">
        {/* Min / Max inputs */}
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="numeric-min">Min</Label>
            <Input
              id="numeric-min"
              type="number"
              value={min}
              onChange={(e) => emit({ min: Number(e.target.value) })}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="numeric-max">Max</Label>
            <Input
              id="numeric-max"
              type="number"
              value={max}
              onChange={(e) => emit({ max: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Min Label / Max Label inputs */}
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="numeric-min-label">Min Label</Label>
            <Input
              id="numeric-min-label"
              type="text"
              placeholder="e.g. Not at all"
              value={minLabel}
              onChange={(e) => emit({ minLabel: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="numeric-max-label">Max Label</Label>
            <Input
              id="numeric-max-label"
              type="text"
              placeholder="e.g. Extremely"
              value={maxLabel}
              onChange={(e) => emit({ maxLabel: e.target.value })}
            />
          </div>
        </div>

        {/* Gradient preview bar */}
        <div>
          <Label className="mb-2 block">Preview</Label>
          <div
            className="h-6 rounded-md"
            style={{
              background: "linear-gradient(to right, #ef4444, #f59e0b, #22c55e)",
            }}
          />
          <div className="mt-1 flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
            <span>
              {min}
              {minLabel !== "" && (
                <span className="ml-1 text-[hsl(var(--muted-foreground))]">({minLabel})</span>
              )}
            </span>
            <span>
              {max}
              {maxLabel !== "" && (
                <span className="ml-1 text-[hsl(var(--muted-foreground))]">({maxLabel})</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </ConfigJsonEditor>
  );
}
