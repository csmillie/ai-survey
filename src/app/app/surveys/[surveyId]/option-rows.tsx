"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
// SortableRow
// ---------------------------------------------------------------------------

interface SortableRowProps {
  id: string;
  index: number;
  total: number;
  opt: BenchmarkOption;
  canRemove: boolean;
  onLabelChange: (index: number, label: string) => void;
  onLabelBlur: (index: number) => void;
  onValueChange: (index: number, value: string) => void;
  onScoreChange: (index: number, raw: string) => void;
  onRemove: (index: number) => void;
}

function SortableRow({
  id,
  index,
  total,
  opt,
  canRemove,
  onLabelChange,
  onLabelBlur,
  onValueChange,
  onScoreChange,
  onRemove,
}: SortableRowProps): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[32px_1fr_1fr_80px_36px] gap-2 px-3 py-1.5 items-center border-b border-[hsl(var(--border))] last:border-b-0"
      aria-label={`Option ${index + 1} of ${total}: ${opt.label || "(empty)"}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="flex items-center justify-center text-[hsl(var(--muted-foreground))] cursor-grab active:cursor-grabbing select-none text-sm leading-none rounded hover:bg-[hsl(var(--muted))] h-8 w-8"
        aria-label={`Drag to reorder option ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>

      {/* Label input */}
      <Input
        value={opt.label}
        onChange={(e) => onLabelChange(index, e.target.value)}
        onBlur={() => onLabelBlur(index)}
        placeholder="Label"
        className="h-8 text-sm"
        aria-label={`Option ${index + 1} label`}
      />

      {/* Value input */}
      <Input
        value={opt.value}
        onChange={(e) => onValueChange(index, e.target.value)}
        placeholder="value_slug"
        className="h-8 text-sm font-mono"
        aria-label={`Option ${index + 1} value`}
      />

      {/* Score input */}
      <Input
        type="number"
        value={opt.numericValue ?? ""}
        onChange={(e) => onScoreChange(index, e.target.value)}
        className="h-8 text-sm"
        aria-label={`Option ${index + 1} score`}
      />

      {/* Remove button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-[hsl(var(--destructive))]"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        aria-label={`Remove option ${index + 1}`}
      >
        <span aria-hidden="true" className="text-xs">
          ✕
        </span>
      </Button>
    </div>
  );
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
  const [manualValueEdits, setManualValueEdits] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    options.forEach((opt, i) => {
      if (opt.value && opt.label && opt.value !== labelToSlug(opt.label)) {
        initial.add(i);
      }
    });
    return initial;
  });

  // Stable IDs for sortable — use index-based keys that reset on add/remove
  const itemIds = useMemo(
    () => options.map((_, i) => `opt-${i}`),
    [options]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = itemIds.indexOf(String(active.id));
      const newIndex = itemIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      const updated = [...options];
      const [moved] = updated.splice(oldIndex, 1);
      updated.splice(newIndex, 0, moved);
      const rescored = recalculateScores(updated);

      // Adjust manual edit tracking for the reorder
      setManualValueEdits((prev) => {
        const next = new Set<number>();
        const mapping = new Map<number, number>();
        // Build old→new index mapping
        const tempArr = Array.from({ length: options.length }, (_, i) => i);
        const [movedIdx] = tempArr.splice(oldIndex, 1);
        tempArr.splice(newIndex, 0, movedIdx);
        tempArr.forEach((origIdx, newIdx) => mapping.set(origIdx, newIdx));

        for (const idx of prev) {
          const mapped = mapping.get(idx);
          if (mapped !== undefined) next.add(mapped);
        }
        return next;
      });

      onChange(rescored);
    },
    [options, onChange, itemIds]
  );

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
      setManualValueEdits((prev) => {
        const next = new Set<number>();
        for (const idx of prev) {
          if (idx < index) next.add(idx);
          else if (idx > index) next.add(idx - 1);
        }
        return next;
      });
      onChange(rescored);
    },
    [options, onChange, minRows]
  );

  const handleAdd = useCallback(() => {
    const updated = [
      ...options,
      { label: "", value: "", numericValue: 1 },
    ];
    const rescored = recalculateScores(updated);
    onChange(rescored);
  }, [options, onChange]);

  const canRemove = options.length > minRows;

  return (
    <div className="w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="rounded-md border border-[hsl(var(--border))]">
          {/* Header row */}
          <div className="grid grid-cols-[32px_1fr_1fr_80px_36px] gap-2 px-3 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
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

          {/* Sortable rows */}
          <SortableContext
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            {options.map((opt, index) => (
              <SortableRow
                key={itemIds[index]}
                id={itemIds[index]}
                index={index}
                total={options.length}
                opt={opt}
                canRemove={canRemove}
                onLabelChange={handleLabelChange}
                onLabelBlur={handleLabelBlur}
                onValueChange={handleValueChange}
                onScoreChange={handleScoreChange}
                onRemove={handleRemove}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>

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
