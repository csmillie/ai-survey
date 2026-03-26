"use client";

import {
  QUESTION_TYPE_LABELS,
  LEGACY_TYPES,
  BENCHMARK_TYPES,
} from "@/app/app/surveys/[surveyId]/question-presets";

interface TypeSidebarProps {
  selectedType: string;
  onSelect: (type: string) => void;
}

export function TypeSidebar({ selectedType, onSelect }: TypeSidebarProps): React.JSX.Element {
  return (
    <div
      role="listbox"
      aria-label="Question type"
      className="flex w-[180px] flex-shrink-0 flex-col border-r bg-muted/30"
    >
      {/* Legacy types group */}
      <div className="px-3 pt-3 pb-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Question Type
        </span>
      </div>
      {LEGACY_TYPES.map((type) => (
        <TypeItem
          key={type}
          type={type}
          label={QUESTION_TYPE_LABELS[type]}
          isSelected={selectedType === type}
          onSelect={onSelect}
        />
      ))}

      {/* Benchmark types group */}
      <div className="mx-3 mt-2 border-t pt-3 pb-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Benchmark Types
        </span>
      </div>
      {BENCHMARK_TYPES.map((type) => (
        <TypeItem
          key={type}
          type={type}
          label={QUESTION_TYPE_LABELS[type]}
          isSelected={selectedType === type}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

interface TypeItemProps {
  type: string;
  label: string;
  isSelected: boolean;
  onSelect: (type: string) => void;
}

function TypeItem({ type, label, isSelected, onSelect }: TypeItemProps): React.JSX.Element {
  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      className={`mx-2 cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors ${
        isSelected
          ? "bg-primary font-semibold text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      onClick={() => onSelect(type)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(type);
        }
      }}
    >
      {label}
    </div>
  );
}
