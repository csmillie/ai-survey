# Question Creation UI Redesign

**Date:** 2026-03-25
**Status:** Approved
**Goal:** Replace the dropdown type selector and raw JSON config editors with a wide-dialog, sidebar-driven UI featuring specialized visual config editors for each question type.

---

## 1. Dialog Layout

Widen the "Add Decision Prompt" dialog from `max-w-lg` (512px) to `w-[80vw] max-w-5xl` (~1024px). The interior splits into three zones:

- **Top zone:** Prompt textarea with `{{variable_name}}` syntax hint. Always visible regardless of type selection.
- **Middle zone:** Horizontal split — type sidebar (180px fixed, left) + config panel (fluid, right).
- **Footer:** Mode toggle (Stateless/Threaded) + conditional thread key input + Cancel / Add Prompt buttons.

The edit flow reuses the same dialog component (replacing the current inline table row editor). Pre-populated with existing values, button label changes to "Save".

## 2. Type Sidebar

Left sidebar lists all 8 question types, grouped with a subtle divider:

**Legacy Types:**
- Open Ended
- Ranked

**Benchmark Types:**
- Single Select
- Binary
- Forced Choice
- Likert
- Numeric Scale
- Matrix Likert

Each item is a clickable row. Selected type gets accent background. Switching types preserves the prompt text but resets the config panel to the new type's defaults.

## 3. Config Panels Per Type

Each type gets a dedicated visual editor in the right panel. All benchmark types include a "Show JSON" toggle that swaps the visual form for a raw JSON textarea.

### Open Ended
Empty state message: "No configuration required for open-ended questions. The model will respond with freeform text." No form fields.

### Ranked
- **Preset pills:** 0–5, 0–10, 0–100. Selecting a preset sets min/max and stores the corresponding `scalePreset` value (`"0-5"`, `"0-10"`, `"0-100"`) as required by `rankedConfigSchema`. No "Custom" option — the schema only accepts these three preset keys.
- **Editable inputs:** Min, Max (number inputs) — editable after selecting a preset, but `scalePreset` stays as the originally selected key.
- **Visual preview:** Gradient bar with labeled endpoints
- **Checkbox:** Include reasoning
- **No "Show JSON" toggle** — Ranked is a legacy type, not a benchmark type.

### Single Select
- **Editable option rows:** Each row has drag handle, label, value, score, X to remove
- **"+ Add option" button** below the rows
- **Checkbox:** Allow "Don't know" response
- **Default state:** Starts with 2 blank rows

### Binary
- **Preset pills:** Yes/No, True/False, Agree/Disagree, Custom
- **Two large cards:** Side-by-side display of each option showing label, value, and score. Selecting a preset auto-fills both cards.
- **Checkbox:** Reverse scored

### Forced Choice
- **Two "Pole" cards** side-by-side separated by "vs" divider
- Each pole has editable fields: label, value, score
- **Optional pole label fields:** `poleALabel` and `poleBLabel` text inputs above each card (maps to optional fields in `forcedChoiceConfigSchema`)
- No presets — always custom content

### Likert
- **Preset pills:** 5-pt Agree/Disagree, 7-pt Agree/Disagree, 4-pt Frequency, 5-pt Satisfaction
- **Editable option rows:** Same drag/edit/remove pattern as Single Select. Selecting a preset populates all rows.
- **Checkbox:** Reverse scored

### Numeric Scale
- **Inputs:** Min (number), Max (number), Min Label (text), Max Label (text)
- **Visual preview:** Gradient bar with labeled endpoints

### Matrix Likert
- **Stem input:** Text field for the instruction stem (e.g., "Rate the following items:")
- **Scale column presets:** 3-pt Amount, 5-pt Agree, Custom
- **Editable option rows:** For column definitions (same drag/edit/remove pattern)
- **Info note:** "Matrix rows are defined by the prompt template. Each row gets the same scale columns."

## 4. Shared Behaviors

### Auto-generated values
When a user types a label (e.g., "Strongly agree"), the `value` field auto-generates a slug: trim, lowercase, replace spaces with underscores, strip non-alphanumeric characters except underscores. Users can click to override. Scores auto-increment based on row position (top row = highest score).

### Preset interaction
Selecting a preset replaces all current options/values with the preset's defaults. If the user has made edits, show a brief inline confirmation: "Replace current options with preset?" — not a modal popup. Applies to all types with presets: Ranked (replaces min/max), Binary (replaces both options), Likert (replaces all option rows), Matrix Likert (replaces column options).

### Show JSON toggle
- Flips the visual form to a monospace JSON textarea showing the current config serialized as JSON
- Edits in JSON mode are validated in real-time with inline error messages
- Switching back to visual mode parses the JSON and populates the form fields
- If the JSON is invalid or has an unexpected shape, stay in JSON mode with an error message — do not corrupt the form state

### Validation
The "Add Prompt" / "Save" button is disabled until:
1. Prompt text is non-empty
2. Type config is valid:
   - Binary / Forced Choice: exactly 2 options
   - Single Select: at least 2 options (per `singleSelectConfigSchema`)
   - Likert: options count matches 4, 5, or 7. The `points` field is auto-derived from `options.length` at submission time — no separate points selector in the UI.
   - Numeric Scale / Ranked: min < max
   - Matrix Likert: at least 2 column options (per `matrixLikertConfigSchema`) + non-empty stem

### Edit mode
Clicking "Edit" on an existing question opens the same dialog (not an inline table row), pre-populated with all current values. The dialog title changes to "Edit Decision Prompt" and the submit button label changes to "Save".

## 5. Component Architecture

### New files

All new components go in `src/app/app/surveys/[surveyId]/`:

| File | Purpose |
|------|---------|
| `question-dialog.tsx` | Outer dialog shell: prompt textarea, sidebar + panel split, footer with mode/actions. Manages form state and submission. Used for both add and edit. |
| `type-sidebar.tsx` | Left sidebar list with grouped types and selection highlight. |
| `option-rows.tsx` | Reusable editable option list with drag handle, click-to-edit, X to remove. Shared by Single Select, Likert, Matrix Likert. |
| `config-ranked.tsx` | Scale presets, min/max inputs, reasoning toggle, gradient preview. |
| `config-single-select.tsx` | Option rows + "Add option" + "Allow Don't Know" checkbox. |
| `config-binary.tsx` | Presets + two-card display + reverse scored checkbox. |
| `config-forced-choice.tsx` | Two-pole editor with label/value/score per side. |
| `config-likert.tsx` | Presets + option rows + reverse scored checkbox. |
| `config-numeric-scale.tsx` | Min/max with labels + gradient preview. |
| `config-matrix-likert.tsx` | Stem input + column presets + option rows + info note. |

### Shared config editor interface

All config editors export a common interface:

```ts
interface ConfigEditorProps {
  value: Record<string, unknown>;
  onChange: (config: Record<string, unknown>, valid: boolean) => void;
}
```

Each config editor is responsible for producing a config object that matches its Zod schema. The parent `question-dialog.tsx` validates the assembled config through the appropriate Zod schema (from `src/lib/schemas.ts`) before calling the server action. This ensures no unsafe casts — the dialog dispatches to the correct schema based on the selected question type.

### QuestionDialog props

```ts
interface QuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyId: string;
  existingQuestions: Array<{ threadKey: string | null }>; // for thread key enumeration
  editQuestion?: QuestionData; // if present, dialog is in edit mode
}
```

The `existingQuestions` prop provides thread key options for the Threaded mode selector — matching the current logic in `survey-builder.tsx`.

### Changes to existing files

- **`survey-builder.tsx`**: Remove the add dialog JSX, the `BenchmarkConfigEditor` component, and the `QuestionEditRow` inline form. Replace with `<QuestionDialog>` calls for both add and edit flows. The questions table, variable tab, and share tab remain.
- **`src/components/ui/dialog.tsx`**: No changes needed — the wider width is applied via className override on `DialogContent` in `question-dialog.tsx`.

### What stays in `survey-builder.tsx`
- Questions table (list of existing questions with edit/delete)
- Variables tab
- Shares tab
- Overall page layout and survey-level actions

## 6. Presets Data

Presets are static arrays defined in a new constants file or colocated in each config editor. They are not stored in the database — they're UI-only shortcuts that populate the config form.

### Ranked presets
Each preset maps to a required `scalePreset` key in the schema:
- 0–5: `{scalePreset: "0-5", scaleMin: 0, scaleMax: 5}`
- 0–10: `{scalePreset: "0-10", scaleMin: 0, scaleMax: 10}`
- 0–100: `{scalePreset: "0-100", scaleMin: 0, scaleMax: 100}`

### Binary presets
- Yes/No: `[{label: "Yes", value: "yes", numericValue: 1}, {label: "No", value: "no", numericValue: 0}]`
- True/False: `[{label: "True", value: "true", numericValue: 1}, {label: "False", value: "false", numericValue: 0}]`
- Agree/Disagree: `[{label: "Agree", value: "agree", numericValue: 1}, {label: "Disagree", value: "disagree", numericValue: 0}]`

### Likert presets
- 5-pt Agree/Disagree: Strongly agree (5) → Strongly disagree (1)
- 7-pt Agree/Disagree: Strongly agree (7) → Strongly disagree (1)
- 4-pt Frequency: Always (4), Often (3), Sometimes (2), Never (1)
- 5-pt Satisfaction: Very satisfied (5) → Very dissatisfied (1)

### Matrix Likert column presets
- 3-pt Amount: A great deal (3), Only some (2), Hardly any (1)
- 5-pt Agree: Same as Likert 5-pt Agree/Disagree

## 7. Accessibility

- **Type sidebar:** Rendered as `role="listbox"` with `role="option"` items. Selected item has `aria-selected="true"`.
- **Option rows reorder:** Drag handles are supplemented with keyboard-accessible up/down arrow buttons (visible on focus) for reordering. Each row has `aria-label` describing its position (e.g., "Option 1 of 5: Strongly agree").
- **Show JSON toggle:** Uses `aria-expanded` to indicate whether the JSON editor is visible.
- **Preset pills:** Rendered as a `role="radiogroup"` with `role="radio"` items.
- **Dialog close on dirty state:** Closing the dialog silently discards changes (matching current behavior). No dirty-state warning — this is intentional to keep the flow fast.

## 8. Out of Scope

- Drag-to-reorder questions in the questions table (separate feature)
- Custom theme/styling for the dialog beyond the 80vw width change
- Database schema changes — all config shapes remain the same
- Changes to the server actions or Zod schemas — the config JSON structure is unchanged
