# Question Creation UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dropdown type selector and raw JSON config editors with a wide-dialog, sidebar-driven UI featuring specialized visual config editors for each of the 8 question types.

**Architecture:** Extract the question creation/edit dialog from `survey-builder.tsx` into a standalone `question-dialog.tsx` component with a vertical type sidebar and per-type config panels. Each config panel is a separate file implementing a shared `ConfigEditorProps` interface. A reusable `option-rows.tsx` component handles the drag/edit/remove option list shared by Single Select, Likert, and Matrix Likert.

**Tech Stack:** Next.js 16 (App Router), TypeScript (strict), Tailwind CSS + shadcn/ui, existing Zod schemas from `src/lib/schemas.ts`, existing server actions from `src/app/app/surveys/[surveyId]/actions.ts`

**Spec:** `docs/superpowers/specs/2026-03-25-question-creation-ui-design.md`

---

### File Structure

All new files go in `src/app/app/surveys/[surveyId]/`:

| File | Responsibility |
|------|---------------|
| `question-dialog.tsx` | Dialog shell: prompt textarea, sidebar + panel split, footer with mode/actions, form state, Zod validation, submission |
| `type-sidebar.tsx` | Left sidebar with Legacy/Benchmark groups, selection state, `role="listbox"` |
| `option-rows.tsx` | Reusable option list: drag handle, click-to-edit label/value/score, X remove, up/down keyboard reorder, "+ Add option" |
| `config-ranked.tsx` | Ranked config: preset pills (0-5, 0-10, 0-100), min/max, reasoning checkbox, gradient preview |
| `config-single-select.tsx` | Single Select: option rows + "Allow Don't Know" checkbox |
| `config-binary.tsx` | Binary: preset pills (Yes/No, True/False, Agree/Disagree, Custom), two-card display, reverse scored |
| `config-forced-choice.tsx` | Forced Choice: two-pole editor with poleALabel/poleBLabel |
| `config-likert.tsx` | Likert: preset pills, option rows, reverse scored |
| `config-numeric-scale.tsx` | Numeric Scale: min/max with labels, gradient preview |
| `config-matrix-likert.tsx` | Matrix Likert: stem, column presets, option rows, info note |
| `config-json-editor.tsx` | Shared "Show JSON" toggle wrapper: JSON textarea with real-time validation, wraps any config panel |
| `question-presets.ts` | All preset data: ranked, binary, likert, matrix likert column presets |

**Modified files:**
| File | Changes |
|------|---------|
| `survey-builder.tsx` | Remove: add dialog JSX, `BenchmarkConfigEditor`, `QuestionEditRow`, `DEFAULT_CONFIGS`. Add: `<QuestionDialog>` for add/edit flows. |

---

### Task 1: Create preset data and shared types

Establish the preset constants and shared `ConfigEditorProps` interface used by all config panels.

**Files:**
- Create: `src/app/app/surveys/[surveyId]/question-presets.ts`

- [ ] **Step 1: Create the presets file**

```typescript
// src/app/app/surveys/[surveyId]/question-presets.ts
import type { BenchmarkOption } from "@/lib/benchmark-types";

// ---------------------------------------------------------------------------
// Shared config editor interface
// ---------------------------------------------------------------------------

export interface ConfigEditorProps {
  value: Record<string, unknown>;
  onChange: (config: Record<string, unknown>, valid: boolean) => void;
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

export function labelToSlug(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9\s_]/g, "").replace(/\s+/g, "_");
}

// ---------------------------------------------------------------------------
// Ranked presets
// ---------------------------------------------------------------------------

export const RANKED_PRESETS = [
  { key: "0-5" as const, label: "0–5", scalePreset: "0-5" as const, scaleMin: 0, scaleMax: 5 },
  { key: "0-10" as const, label: "0–10", scalePreset: "0-10" as const, scaleMin: 0, scaleMax: 10 },
  { key: "0-100" as const, label: "0–100", scalePreset: "0-100" as const, scaleMin: 0, scaleMax: 100 },
] as const;

// ---------------------------------------------------------------------------
// Binary presets
// ---------------------------------------------------------------------------

export interface BinaryPreset {
  key: string;
  label: string;
  options: [BenchmarkOption, BenchmarkOption];
}

export const BINARY_PRESETS: BinaryPreset[] = [
  {
    key: "yes-no",
    label: "Yes / No",
    options: [
      { label: "Yes", value: "yes", numericValue: 1 },
      { label: "No", value: "no", numericValue: 0 },
    ],
  },
  {
    key: "true-false",
    label: "True / False",
    options: [
      { label: "True", value: "true", numericValue: 1 },
      { label: "False", value: "false", numericValue: 0 },
    ],
  },
  {
    key: "agree-disagree",
    label: "Agree / Disagree",
    options: [
      { label: "Agree", value: "agree", numericValue: 1 },
      { label: "Disagree", value: "disagree", numericValue: 0 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Likert presets
// ---------------------------------------------------------------------------

export interface LikertPreset {
  key: string;
  label: string;
  options: BenchmarkOption[];
}

export const LIKERT_PRESETS: LikertPreset[] = [
  {
    key: "5-agree",
    label: "5-pt Agree/Disagree",
    options: [
      { label: "Strongly agree", value: "strongly_agree", numericValue: 5 },
      { label: "Agree", value: "agree", numericValue: 4 },
      { label: "Neither agree nor disagree", value: "neither", numericValue: 3 },
      { label: "Disagree", value: "disagree", numericValue: 2 },
      { label: "Strongly disagree", value: "strongly_disagree", numericValue: 1 },
    ],
  },
  {
    key: "7-agree",
    label: "7-pt Agree/Disagree",
    options: [
      { label: "Strongly agree", value: "strongly_agree", numericValue: 7 },
      { label: "Agree", value: "agree", numericValue: 6 },
      { label: "Somewhat agree", value: "somewhat_agree", numericValue: 5 },
      { label: "Neither agree nor disagree", value: "neither", numericValue: 4 },
      { label: "Somewhat disagree", value: "somewhat_disagree", numericValue: 3 },
      { label: "Disagree", value: "disagree", numericValue: 2 },
      { label: "Strongly disagree", value: "strongly_disagree", numericValue: 1 },
    ],
  },
  {
    key: "4-frequency",
    label: "4-pt Frequency",
    options: [
      { label: "Always", value: "always", numericValue: 4 },
      { label: "Often", value: "often", numericValue: 3 },
      { label: "Sometimes", value: "sometimes", numericValue: 2 },
      { label: "Never", value: "never", numericValue: 1 },
    ],
  },
  {
    key: "5-satisfaction",
    label: "5-pt Satisfaction",
    options: [
      { label: "Very satisfied", value: "very_satisfied", numericValue: 5 },
      { label: "Satisfied", value: "satisfied", numericValue: 4 },
      { label: "Neutral", value: "neutral", numericValue: 3 },
      { label: "Dissatisfied", value: "dissatisfied", numericValue: 2 },
      { label: "Very dissatisfied", value: "very_dissatisfied", numericValue: 1 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Matrix Likert column presets
// ---------------------------------------------------------------------------

export const MATRIX_LIKERT_PRESETS: LikertPreset[] = [
  {
    key: "3-amount",
    label: "3-pt Amount",
    options: [
      { label: "A great deal", value: "great_deal", numericValue: 3 },
      { label: "Only some", value: "only_some", numericValue: 2 },
      { label: "Hardly any", value: "hardly_any", numericValue: 1 },
    ],
  },
  {
    key: "5-agree",
    label: "5-pt Agree",
    options: LIKERT_PRESETS[0].options,
  },
];

// ---------------------------------------------------------------------------
// Default configs for each question type
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  OPEN_ENDED: {},
  RANKED: { scalePreset: "0-5", scaleMin: 0, scaleMax: 5, includeReasoning: true },
  SINGLE_SELECT: {
    type: "SINGLE_SELECT",
    options: [
      { label: "Option A", value: "option_a", numericValue: 2 },
      { label: "Option B", value: "option_b", numericValue: 1 },
    ],
  },
  BINARY: {
    type: "BINARY",
    options: BINARY_PRESETS[0].options,
  },
  FORCED_CHOICE: {
    type: "FORCED_CHOICE",
    options: [
      { label: "Position A", value: "a", numericValue: 1 },
      { label: "Position B", value: "b", numericValue: 0 },
    ],
  },
  LIKERT: {
    type: "LIKERT",
    points: 5,
    options: LIKERT_PRESETS[0].options,
  },
  NUMERIC_SCALE: {
    type: "NUMERIC_SCALE",
    min: 0,
    max: 10,
    minLabel: "",
    maxLabel: "",
  },
  MATRIX_LIKERT: {
    type: "MATRIX_LIKERT",
    stem: "Rate the following items:",
    options: MATRIX_LIKERT_PRESETS[0].options,
  },
};

// ---------------------------------------------------------------------------
// Question type metadata
// ---------------------------------------------------------------------------

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  OPEN_ENDED: "Open Ended",
  RANKED: "Ranked",
  SINGLE_SELECT: "Single Select",
  BINARY: "Binary",
  FORCED_CHOICE: "Forced Choice",
  LIKERT: "Likert",
  NUMERIC_SCALE: "Numeric Scale",
  MATRIX_LIKERT: "Matrix Likert",
};

export const QUESTION_TYPE_DESCRIPTIONS: Record<string, string> = {
  OPEN_ENDED: "Freeform text response",
  RANKED: "Numeric rating on a predefined scale",
  SINGLE_SELECT: "Pick one option from a list",
  BINARY: "True/false or yes/no choice",
  FORCED_CHOICE: "Choose between two opposing positions",
  LIKERT: "Agreement or frequency scale",
  NUMERIC_SCALE: "Continuous numeric range with labels",
  MATRIX_LIKERT: "Multiple rows on the same scale",
};

export const LEGACY_TYPES = ["OPEN_ENDED", "RANKED"] as const;
export const BENCHMARK_TYPES = ["SINGLE_SELECT", "BINARY", "FORCED_CHOICE", "LIKERT", "NUMERIC_SCALE", "MATRIX_LIKERT"] as const;

// ---------------------------------------------------------------------------
// QuestionData — moved from survey-builder.tsx for sharing with question-dialog.tsx
// ---------------------------------------------------------------------------

export interface QuestionData {
  id: string;
  title: string;
  promptTemplate: string;
  mode: string;
  threadKey: string | null;
  order: number;
  type: string;
  configJson: Record<string, unknown> | null;
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/app/surveys/\[surveyId\]/question-presets.ts
git commit -m "feat: add question presets, shared types, and slug helper"
```

---

### Task 2: Create the reusable option rows component

The draggable, editable option list used by Single Select, Likert, and Matrix Likert.

**Files:**
- Create: `src/app/app/surveys/[surveyId]/option-rows.tsx`

- [ ] **Step 1: Create the component**

Build `option-rows.tsx` with:
- Props: `options: BenchmarkOption[]`, `onChange: (options: BenchmarkOption[]) => void`, `minRows?: number`
- Each row: drag handle (⋮⋮), click-to-edit label input, value input (auto-slugged from label), score number input, X remove button
- Up/down arrow buttons visible on focus for keyboard reordering
- `aria-label` per row: "Option {n} of {total}: {label}"
- "+ Add option" button at bottom
- Auto-slug: `labelToSlug()` from `question-presets.ts` applied on label blur if value hasn't been manually edited
- Auto-score: top row = highest score based on options.length, decrements by 1

- [ ] **Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/app/surveys/\[surveyId\]/option-rows.tsx
git commit -m "feat: add reusable option rows component with drag, edit, remove"
```

---

### Task 3: Create the type sidebar component

**Files:**
- Create: `src/app/app/surveys/[surveyId]/type-sidebar.tsx`

- [ ] **Step 1: Create the component**

Build `type-sidebar.tsx` with:
- Props: `selectedType: string`, `onSelect: (type: string) => void`
- Renders `role="listbox"` container
- Two groups separated by a divider: "Legacy Types" (OPEN_ENDED, RANKED) and "Benchmark Types" (SINGLE_SELECT through MATRIX_LIKERT)
- Each item: `role="option"`, `aria-selected={isSelected}`, accent background when selected
- Uses `QUESTION_TYPE_LABELS` from `question-presets.ts`
- Group headers: uppercase, muted, small text with top border on the benchmark section

- [ ] **Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/app/surveys/\[surveyId\]/type-sidebar.tsx
git commit -m "feat: add question type sidebar with grouped types"
```

---

### Task 4: Create the JSON editor wrapper component

The "Show JSON" toggle that wraps any config panel.

**Files:**
- Create: `src/app/app/surveys/[surveyId]/config-json-editor.tsx`

- [ ] **Step 1: Create the component**

Build `config-json-editor.tsx` with:
- Props: `config: Record<string, unknown>`, `questionType: string`, `onConfigChange: (config: Record<string, unknown>, valid: boolean) => void`, `children: React.ReactNode` (the visual editor)
- State: `showJson: boolean`, `jsonText: string`, `jsonError: string | null`
- When `showJson` is false: renders children (the visual editor) + a "Show JSON" button in the top-right
- When `showJson` is true: renders a monospace `<Textarea>` with the JSON serialized, real-time validation, error display, and "Show Visual" button
- "Show JSON" button: `aria-expanded={showJson}`
- On toggle back to visual: parse JSON, if valid call `onConfigChange`, if invalid stay in JSON mode with error

- [ ] **Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/app/surveys/\[surveyId\]/config-json-editor.tsx
git commit -m "feat: add JSON editor wrapper with show/hide toggle"
```

---

### Task 5: Create config editors — Ranked and Numeric Scale

These two are similar (min/max with gradient preview) so build together.

**Files:**
- Create: `src/app/app/surveys/[surveyId]/config-ranked.tsx`
- Create: `src/app/app/surveys/[surveyId]/config-numeric-scale.tsx`

- [ ] **Step 1: Create config-ranked.tsx**

Build with:
- Preset pills: 3 buttons for "0–5", "0–10", "0–100" using `RANKED_PRESETS`. Selected preset has accent background, rendered as `role="radiogroup"` with `role="radio"` items.
- Editable Min/Max number inputs (update on change, but `scalePreset` stays as selected key)
- Gradient preview bar with labeled endpoints
- "Include reasoning" checkbox
- Calls `onChange` with `{ scalePreset, scaleMin, scaleMax, includeReasoning }`, valid when `scaleMin < scaleMax`
- **No `ConfigJsonEditor` wrapper** — Ranked is a legacy type, not a benchmark type (per spec Section 3)

- [ ] **Step 2: Create config-numeric-scale.tsx**

Build with:
- Min/Max number inputs
- Min Label / Max Label text inputs
- Gradient preview bar with labeled endpoints
- Calls `onChange` with `{ type: "NUMERIC_SCALE", min, max, minLabel, maxLabel }`, valid when `min < max`
- Wrapped in `ConfigJsonEditor` for the "Show JSON" toggle

- [ ] **Step 3: Run type check**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/app/surveys/\[surveyId\]/config-ranked.tsx src/app/app/surveys/\[surveyId\]/config-numeric-scale.tsx
git commit -m "feat: add ranked and numeric scale config editors"
```

---

### Task 6: Create config editors — Binary and Forced Choice

These two share the "exactly 2 options" pattern.

**Files:**
- Create: `src/app/app/surveys/[surveyId]/config-binary.tsx`
- Create: `src/app/app/surveys/[surveyId]/config-forced-choice.tsx`

- [ ] **Step 1: Create config-binary.tsx**

Build with:
- Preset pills: `BINARY_PRESETS` + "Custom" option. `role="radiogroup"`.
- Two large side-by-side cards showing label, value, score for each option. Click card to edit fields inline.
- Selecting a preset auto-fills both cards. If user has made edits, show inline "Replace current options?" confirmation text.
- "Reverse scored" checkbox
- Wrapped in `ConfigJsonEditor`
- Calls `onChange` with `{ type: "BINARY", options: [opt1, opt2], reverseScored }`, always valid (presets ensure 2 options)

- [ ] **Step 2: Create config-forced-choice.tsx**

Build with:
- Two "Pole" cards separated by "vs" divider
- Each pole: editable label, value, score fields
- `poleALabel` and `poleBLabel` text inputs above each card
- No presets
- Wrapped in `ConfigJsonEditor`
- Calls `onChange` with `{ type: "FORCED_CHOICE", options: [opt1, opt2], poleALabel, poleBLabel }`, valid when both options have non-empty labels

- [ ] **Step 3: Run type check**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/app/surveys/\[surveyId\]/config-binary.tsx src/app/app/surveys/\[surveyId\]/config-forced-choice.tsx
git commit -m "feat: add binary and forced choice config editors"
```

---

### Task 7: Create config editors — Single Select, Likert, Matrix Likert

These three share the `option-rows.tsx` component.

**Files:**
- Create: `src/app/app/surveys/[surveyId]/config-single-select.tsx`
- Create: `src/app/app/surveys/[surveyId]/config-likert.tsx`
- Create: `src/app/app/surveys/[surveyId]/config-matrix-likert.tsx`

- [ ] **Step 1: Create config-single-select.tsx**

Build with:
- `<OptionRows>` component for the options list
- "Allow Don't Know" checkbox
- Wrapped in `ConfigJsonEditor`
- Calls `onChange` with `{ type: "SINGLE_SELECT", options, allowDontKnow }`, valid when `options.length >= 2` and all labels/values non-empty

- [ ] **Step 2: Create config-likert.tsx**

Build with:
- Preset pills: `LIKERT_PRESETS` rendered as `role="radiogroup"`. Selecting a preset replaces all options (with inline confirmation if user has edited).
- `<OptionRows>` for the options
- "Reverse scored" checkbox
- Wrapped in `ConfigJsonEditor`
- `points` is auto-derived: `options.length` cast to `4 | 5 | 7` at submission time
- Calls `onChange` with `{ type: "LIKERT", points: options.length, options, reverseScored }`, valid when `options.length` is 4, 5, or 7

- [ ] **Step 3: Create config-matrix-likert.tsx**

Build with:
- Stem text input
- Column preset pills: `MATRIX_LIKERT_PRESETS` + "Custom" rendered as `role="radiogroup"`
- `<OptionRows>` for column definitions
- Info note: "Matrix rows are defined by the prompt template."
- Wrapped in `ConfigJsonEditor`
- Calls `onChange` with `{ type: "MATRIX_LIKERT", stem, options }`, valid when `stem` non-empty and `options.length >= 2`

- [ ] **Step 4: Run type check**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/app/surveys/\[surveyId\]/config-single-select.tsx src/app/app/surveys/\[surveyId\]/config-likert.tsx src/app/app/surveys/\[surveyId\]/config-matrix-likert.tsx
git commit -m "feat: add single select, likert, and matrix likert config editors"
```

---

### Task 8: Create the question dialog shell

The main dialog that assembles all pieces.

**Files:**
- Create: `src/app/app/surveys/[surveyId]/question-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

Build `question-dialog.tsx` with:

**Props:**
```typescript
interface QuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyId: string;
  existingQuestions: Array<{ threadKey: string | null }>;
  editQuestion?: QuestionData;
}
```

**Layout:**
- `<DialogContent className="w-[80vw] max-w-5xl max-h-[85vh] flex flex-col p-0">`
- Top zone: prompt `<Textarea>` with variable syntax hint
- Middle zone: `flex` row — `<TypeSidebar>` (180px) | config panel (flex-1, overflow-y-auto)
- Config panel renders the appropriate config editor based on `selectedType`:
  - `OPEN_ENDED`: empty state message
  - `RANKED`: `<ConfigRanked>`
  - `SINGLE_SELECT`: `<ConfigSingleSelect>`
  - `BINARY`: `<ConfigBinary>`
  - `FORCED_CHOICE`: `<ConfigForcedChoice>`
  - `LIKERT`: `<ConfigLikert>`
  - `NUMERIC_SCALE`: `<ConfigNumericScale>`
  - `MATRIX_LIKERT`: `<ConfigMatrixLikert>`
- Footer: mode toggle (Stateless/Threaded), thread key input (conditional), Cancel + Add Prompt/Save buttons

**State:**
- `selectedType`: string (default "OPEN_ENDED", or `editQuestion.type`)
- `promptText`: string
- `config`: `Record<string, unknown>` — reset to `DEFAULT_CONFIGS[type]` on type change
- `configValid`: boolean
- `mode`: "STATELESS" | "THREADED"
- Thread key state (mirrors current survey-builder logic)

**Submission:**
- Assemble `FormData` with: `promptTemplate`, `type`, `mode`, `threadKey`, `configJson` (JSON.stringify of config)
- Validate config through the appropriate Zod schema before submitting
- Call `addQuestionAction.bind(null, surveyId)` for add, or `updateQuestionAction.bind(null, surveyId, editQuestion.id)` for edit
- On success: call `onOpenChange(false)` to close dialog
- On error: display inline error

**Edit mode:**
- When `editQuestion` is provided: pre-populate all fields from `editQuestion`
- Dialog title: "Edit Decision Prompt" instead of "Add Decision Prompt"
- Submit button: "Save" instead of "Add Prompt"
- Parse `editQuestion.configJson` to populate the config state

- [ ] **Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/app/surveys/\[surveyId\]/question-dialog.tsx
git commit -m "feat: add question dialog shell with type routing and submission"
```

---

### Task 9: Integrate into survey-builder.tsx

Replace the old add dialog, `BenchmarkConfigEditor`, and `QuestionEditRow` with the new `QuestionDialog`.

**Files:**
- Modify: `src/app/app/surveys/[surveyId]/survey-builder.tsx`

- [ ] **Step 1: Remove old code, add QuestionDialog**

In `survey-builder.tsx`:

1. Remove the `DEFAULT_CONFIGS` object (lines ~1006-1056)
2. Remove the `BenchmarkConfigEditor` component (lines ~1058-1125)
3. Remove the `QuestionEditRow` component (lines ~727-1000)
4. Remove the `QUESTION_TYPE_LABELS` constant (lines ~65-74) — now in `question-presets.ts`
5. Remove the add dialog JSX from `QuestionsTab` (the `<Dialog>` block around lines ~428-638)
6. Remove all add-dialog and edit-row state that now lives in `question-dialog.tsx`:
   - `questionType`, `scalePreset`, `scaleMin`, `scaleMax`, `includeReasoning`, `configValid`, `addFormRef`
   - `questionMode`, `creatingNewThread`, `threadKeySelection`, `newThreadKey`
   - `editingId` state (`useState<string | null>(null)`)
   - `handleAddQuestion` function
   - `generateThreadKey` function
   - `ALL_TYPES` and `BENCHMARK_TYPES` local constants
   - `SCALE_PRESETS` import from `@/lib/schemas` (if no longer used elsewhere in the file)
7. Remove the inline edit row rendering (the `editingId === q.id ? <QuestionEditRow>` branch in the questions table)
8. Import `QuestionData` from `./question-presets` instead of defining it locally (remove the local interface)

Add:
1. Import `QuestionDialog` from `./question-dialog`
2. Import `QUESTION_TYPE_LABELS` from `./question-presets`
3. State: `const [addDialogOpen, setAddDialogOpen] = useState(false);` (keep existing)
4. State: `const [editQuestion, setEditQuestion] = useState<QuestionData | null>(null);`
5. In the "Add Prompt" button area: `<Button onClick={() => setAddDialogOpen(true)}>Add Prompt</Button>`
6. Render two `<QuestionDialog>` instances:
   - Add: `<QuestionDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} surveyId={surveyId} existingQuestions={questions} />`
   - Edit: `<QuestionDialog open={!!editQuestion} onOpenChange={(open) => { if (!open) setEditQuestion(null); }} surveyId={surveyId} existingQuestions={questions} editQuestion={editQuestion ?? undefined} />`
7. In the questions table: replace the "Edit" button click handler from `setEditingId(q.id)` to `setEditQuestion(q)`

- [ ] **Step 2: Run lint and type check**

Run: `pnpm lint && pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: All 395+ tests pass (no existing tests touch UI components)

- [ ] **Step 4: Commit**

```bash
git add src/app/app/surveys/\[surveyId\]/survey-builder.tsx
git commit -m "feat: integrate question dialog, remove old inline editors"
```

---

### Task 10: Manual testing and polish

Verify the full flow works end-to-end in the browser.

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Test each question type**

Navigate to a survey, click "Add Prompt", and test:
1. Open Ended — verify empty state message, add prompt, submit
2. Ranked — select each preset, verify min/max update, toggle reasoning, submit
3. Single Select — add/remove options, verify auto-slug and auto-score, submit
4. Binary — select each preset, verify cards update, submit
5. Forced Choice — fill both poles with custom labels, submit
6. Likert — select each preset, verify option rows populate, try adding/removing, submit
7. Numeric Scale — set min/max/labels, verify preview, submit
8. Matrix Likert — set stem, select column preset, submit

- [ ] **Step 3: Test edit mode**

Click "Edit" on an existing question. Verify:
- Dialog opens with pre-populated values
- Type is selected in sidebar
- Config panel shows existing config
- Changes save correctly

- [ ] **Step 4: Test Show JSON toggle**

For any benchmark type:
- Click "Show JSON" — verify JSON textarea appears with correct config
- Edit JSON — verify validation feedback
- Toggle back — verify form repopulates
- Submit from JSON mode — verify works

- [ ] **Step 5: Test edge cases**

- Submit with empty prompt — button should be disabled
- Remove all options from Single Select — button should be disabled
- Set min > max on Numeric Scale — button should be disabled
- Switch types mid-edit — verify prompt preserved, config reset

- [ ] **Step 6: Run full checks**

Run: `pnpm lint && pnpm tsc --noEmit && pnpm test`
Expected: All pass

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: polish question dialog based on manual testing"
```
