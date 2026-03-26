"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConfigEditorProps } from "@/app/app/surveys/[surveyId]/question-presets";
import { RANKED_PRESETS } from "@/app/app/surveys/[surveyId]/question-presets";

export function ConfigRanked({ value, onChange }: ConfigEditorProps): React.ReactElement {
  const scalePreset = (value.scalePreset as string) ?? "0-5";
  const scaleMin = typeof value.scaleMin === "number" ? value.scaleMin : 0;
  const scaleMax = typeof value.scaleMax === "number" ? value.scaleMax : 5;
  const includeReasoning = typeof value.includeReasoning === "boolean" ? value.includeReasoning : true;

  const emit = useCallback(
    (patch: Partial<{ scalePreset: string; scaleMin: number; scaleMax: number; includeReasoning: boolean }>): void => {
      const next = {
        scalePreset: patch.scalePreset ?? scalePreset,
        scaleMin: patch.scaleMin ?? scaleMin,
        scaleMax: patch.scaleMax ?? scaleMax,
        includeReasoning: patch.includeReasoning ?? includeReasoning,
      };
      onChange(next, next.scaleMin < next.scaleMax);
    },
    [scalePreset, scaleMin, scaleMax, includeReasoning, onChange],
  );

  return (
    <div className="space-y-5">
      {/* Preset pills */}
      <div>
        <Label className="mb-2 block">Scale Preset</Label>
        <div role="radiogroup" aria-label="Scale preset" className="flex gap-2">
          {RANKED_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              role="radio"
              aria-checked={scalePreset === preset.key}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                scalePreset === preset.key
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]"
              }`}
              onClick={() => emit({ scalePreset: preset.key, scaleMin: preset.scaleMin, scaleMax: preset.scaleMax })}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Min / Max inputs */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Label htmlFor="ranked-min">Min</Label>
          <Input
            id="ranked-min"
            type="number"
            value={scaleMin}
            onChange={(e) => emit({ scaleMin: Number(e.target.value) })}
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="ranked-max">Max</Label>
          <Input
            id="ranked-max"
            type="number"
            value={scaleMax}
            onChange={(e) => emit({ scaleMax: Number(e.target.value) })}
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
          <span>{scaleMin}</span>
          <span>{scaleMax}</span>
        </div>
      </div>

      {/* Include reasoning checkbox */}
      <div className="flex items-center gap-2">
        <input
          id="ranked-reasoning"
          type="checkbox"
          checked={includeReasoning}
          onChange={(e) => emit({ includeReasoning: e.target.checked })}
          className="h-4 w-4 rounded border-[hsl(var(--border))]"
        />
        <Label htmlFor="ranked-reasoning">Include reasoning</Label>
      </div>
    </div>
  );
}
