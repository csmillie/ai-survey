"use client";

import React, { useCallback, useState } from "react";
import type { BenchmarkOption } from "@/lib/benchmark-types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { labelToSlug } from "./question-presets";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OptionRowsProps {
  options: BenchmarkOption[];
  onChange: (options: BenchmarkOption[]) => void;
  minRows?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function recalculateScores(options: BenchmarkOption[]): BenchmarkOption[] {
  return options.map((opt, i) => ({
    ...opt,
    numericValue: options.length - i,
  }));
}

// ---------------------------------------------------------------------------
// OptionRows
// ---------------------------------------------------------------------------

export function OptionRows({
  options,
  onChange,
  minRows = 0,
}: OptionRowsProps): React.ReactElement {
  // Track which row indices have had their value manually edited.
  // On mount, detect options whose value doesn't match their label slug
  // and pre-mark them so auto-slug doesn't overwrite them.
  const [manualValueEdits, setManualValueEdits] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    options.forEach((opt, i) => {
      if (opt.value && opt.label && opt.value !== labelToSlug(opt.label)) {
        initial.add(i);
      }
    });
    return initial;
  });


  const updateOption = useCallback(
    (index: number, patch: Partial<BenchmarkOption>) => {
      const updated = options.map((opt, i) =>
        i === index ? { ...opt, ...patch } : opt
      );
      onChange(updated);
    },
    [options, onChange]
  );

  const handleLabelChange = useCallback(
    (index: number, label: string) => {
      updateOption(index, { label });
    },
    [updateOption]
  );

  const handleLabelBlur = useCallback(
    (index: number) => {
      if (manualValueEdits.has(index)) return;
      const opt = options[index];
      if (!opt) return;
      const slug = labelToSlug(opt.label);
      if (slug !== opt.value) {
        updateOption(index, { value: slug });
      }
    },
    [options, updateOption, manualValueEdits]
  );

  const handleValueChange = useCallback(
    (index: number, value: string) => {
      setManualValueEdits((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
      updateOption(index, { value });
    },
    [updateOption]
  );

  const handleScoreChange = useCallback(
    (index: number, raw: string) => {
      const num = raw === "" ? 0 : Number(raw);
      if (!Number.isFinite(num)) return;
      updateOption(index, { numericValue: num });
    },
    [updateOption]
  );

  const handleRemove = useCallback(
    (index: number) => {
      if (options.length <= minRows) return;
      const updated = options.filter((_, i) => i !== index);
      const rescored = recalculateScores(updated);
      // Adjust manual edits set: remove the deleted index, shift higher indices down.
      setManualValueEdits((prev) => {
        const next = new Set<number>();
        for (const idx of prev) {
          if (idx < index) next.add(idx);
          else if (idx > index) next.add(idx - 1);
          // idx === index is dropped
        }
        return next;
      });
      onChange(rescored);
    },
    [options, onChange, minRows]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const updated = [...options];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      const rescored = recalculateScores(updated);
      // Swap manual edit tracking too.
      setManualValueEdits((prev) => {
        const next = new Set<number>();
        for (const idx of prev) {
          if (idx === index) next.add(index - 1);
          else if (idx === index - 1) next.add(index);
          else next.add(idx);
        }
        return next;
      });
      onChange(rescored);
    },
    [options, onChange]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= options.length - 1) return;
      const updated = [...options];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      const rescored = recalculateScores(updated);
      setManualValueEdits((prev) => {
        const next = new Set<number>();
        for (const idx of prev) {
          if (idx === index) next.add(index + 1);
          else if (idx === index + 1) next.add(index);
          else next.add(idx);
        }
        return next;
      });
      onChange(rescored);
    },
    [options, onChange]
  );

  const handleAdd = useCallback(() => {
    const newScore = 1; // Will be recalculated
    const updated = [
      ...options,
      { label: "", value: "", numericValue: newScore },
    ];
    const rescored = recalculateScores(updated);
    onChange(rescored);
  }, [options, onChange]);

  return (
    <div className="w-full">
      {/* Table container with rounded border */}
      <div className="rounded-md border border-[hsl(var(--border))]">
        {/* Header row */}
        <div className="grid grid-cols-[32px_1fr_1fr_80px_96px] gap-2 px-3 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
          <div />
          <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Label
          </div>
          <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Value
          </div>
          <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Score
          </div>
          <div />
        </div>

        {/* Option rows */}
        {options.map((opt, index) => (
          <div
            key={index}
            className="group grid grid-cols-[32px_1fr_1fr_80px_96px] gap-2 px-3 py-1.5 items-center border-b border-[hsl(var(--border))] last:border-b-0"
            aria-label={`Option ${index + 1} of ${options.length}: ${opt.label || "(empty)"}`}
          >
            {/* Drag handle (visual only) */}
            <span
              className="text-[hsl(var(--muted-foreground))] cursor-grab select-none text-center text-sm leading-none"
              aria-hidden="true"
            >
              ⋮⋮
            </span>

            {/* Label input */}
            <Input
              value={opt.label}
              onChange={(e) => handleLabelChange(index, e.target.value)}
              onBlur={() => handleLabelBlur(index)}
              placeholder="Label"
              className="h-8 text-sm"
              aria-label={`Option ${index + 1} label`}
            />

            {/* Value input */}
            <Input
              value={opt.value}
              onChange={(e) => handleValueChange(index, e.target.value)}
              placeholder="value_slug"
              className="h-8 text-sm font-mono"
              aria-label={`Option ${index + 1} value`}
            />

            {/* Score input */}
            <Input
              type="number"
              value={opt.numericValue ?? ""}
              onChange={(e) => handleScoreChange(index, e.target.value)}
              className="h-8 text-sm"
              aria-label={`Option ${index + 1} score`}
            />

            {/* Actions: reorder + remove */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                aria-label={`Move option ${index + 1} up`}
              >
                <span aria-hidden="true" className="text-xs">
                  ↑
                </span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleMoveDown(index)}
                disabled={index >= options.length - 1}
                aria-label={`Move option ${index + 1} down`}
              >
                <span aria-hidden="true" className="text-xs">
                  ↓
                </span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[hsl(var(--destructive))]"
                onClick={() => handleRemove(index)}
                disabled={options.length <= minRows}
                aria-label={`Remove option ${index + 1}`}
              >
                <span aria-hidden="true" className="text-xs">
                  ✕
                </span>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add option button */}
      <Button
        type="button"
        variant="ghost"
        className="mt-2 text-sm"
        onClick={handleAdd}
      >
        + Add option
      </Button>
    </div>
  );
}
