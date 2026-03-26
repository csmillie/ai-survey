"use client";

import { useCallback, useState } from "react";
import { Label } from "@/components/ui/label";
import type { BenchmarkOption } from "@/lib/benchmark-types";
import type { ConfigEditorProps } from "@/app/app/surveys/[surveyId]/question-presets";
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
  return [
    { label: "Option A", value: "option_a", numericValue: 2 },
    { label: "Option B", value: "option_b", numericValue: 1 },
  ];
}

function isValid(options: BenchmarkOption[]): boolean {
  return (
    options.length >= 2 &&
    options.every((opt) => opt.label.trim() !== "" && opt.value.trim() !== "")
  );
}

export function ConfigSingleSelect({ value, onChange }: ConfigEditorProps): React.ReactElement {
  const [options, setOptions] = useState<BenchmarkOption[]>(() => extractOptions(value));
  const [allowDontKnow, setAllowDontKnow] = useState<boolean>(
    () => typeof value.allowDontKnow === "boolean" ? value.allowDontKnow : false
  );

  const emit = useCallback(
    (nextOptions: BenchmarkOption[], nextAllowDontKnow: boolean): void => {
      const config: Record<string, unknown> = {
        type: "SINGLE_SELECT",
        options: nextOptions,
        allowDontKnow: nextAllowDontKnow,
      };
      onChange(config, isValid(nextOptions));
    },
    [onChange],
  );

  const handleOptionsChange = useCallback(
    (nextOptions: BenchmarkOption[]): void => {
      setOptions(nextOptions);
      emit(nextOptions, allowDontKnow);
    },
    [allowDontKnow, emit],
  );

  const handleAllowDontKnowChange = useCallback(
    (checked: boolean): void => {
      setAllowDontKnow(checked);
      emit(options, checked);
    },
    [options, emit],
  );

  return (
    <ConfigJsonEditor config={{ type: "SINGLE_SELECT", options, allowDontKnow }} questionType="SINGLE_SELECT" onConfigChange={onChange}>
      <div className="space-y-5">
        {/* Option rows */}
        <div>
          <Label className="mb-2 block">Options</Label>
          <OptionRows options={options} onChange={handleOptionsChange} minRows={2} />
        </div>

        {/* Allow Don't Know checkbox */}
        <div className="flex items-center gap-2">
          <input
            id="single-select-dont-know"
            type="checkbox"
            checked={allowDontKnow}
            onChange={(e) => handleAllowDontKnowChange(e.target.checked)}
            className="h-4 w-4 rounded border-[hsl(var(--border))]"
          />
          <Label htmlFor="single-select-dont-know">Allow &quot;Don&apos;t Know&quot; response</Label>
        </div>
      </div>
    </ConfigJsonEditor>
  );
}
