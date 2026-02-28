# Ranked Questions Design

## Summary

Add a "Ranked" question type alongside the existing open-ended text questions. Ranked questions ask the LLM to respond with a numeric score on a configurable scale, optionally including reasoning. Results are displayed with bar visualizations and cross-model score comparisons.

## Schema & Data Model

### Question Model

- Add `QuestionType` enum: `OPEN_ENDED` (default), `RANKED`
- Add `type` field to `Question` model (defaults to `OPEN_ENDED`)
- Add `configJson` column (`Json?`) for type-specific configuration
- Existing questions are unaffected (`type = OPEN_ENDED`, `configJson = null`)

### Ranked Question Config (stored in `configJson`)

Validated by a Zod discriminated union:

```typescript
{
  scalePreset: "1-5" | "1-10" | "1-100" | "percentage",
  scaleMin: number,   // editable, defaults populated from preset
  scaleMax: number,   // editable, defaults populated from preset
  includeReasoning: boolean
}
```

Preset defaults:
| Preset | Min | Max |
|--------|-----|-----|
| 1-5 | 1 | 5 |
| 1-10 | 1 | 10 |
| 1-100 | 1 | 100 |
| percentage | 0 | 100 |

### LlmResponse Model

- Add `reasoningText` column (`String? @db.Text`) for storing reasoning when `includeReasoning` is true

### Ranked Response JSON Schema (parsedJson)

```typescript
{
  score: number,
  reasoning?: string
}
```

## Survey Builder UI

### Question Creation Dialog

- Add question type selector (toggle/radio) at top: "Open Ended" | "Ranked"
- When "Ranked" is selected, show:
  - Scale preset dropdown: "1 to 5", "1 to 10", "1 to 100", "Percentage"
  - Min field (number input, pre-filled from preset, editable)
  - Max field (number input, pre-filled from preset, editable)
  - Include reasoning checkbox/switch
- Prompt template field remains for question text with `{{variable}}` support
- Mode (STATELESS/THREADED) still applies

### Question List

- Show type badge: "Ranked 1-10" or "Open Ended"
- Editing ranked questions allows changing scale config

## Execution

### System Prompt (Ranked)

```
You are a research evaluator. You will be asked to rate something on a numeric scale.
Respond ONLY with valid JSON in the exact format specified. Do not include any text outside the JSON.
```

### User Prompt Construction

User's prompt template (with variables substituted) followed by:

```
Rate your response on a scale from {scaleMin} to {scaleMax}.

Respond with ONLY valid JSON matching this schema:
{
  "score": <integer from {scaleMin} to {scaleMax}>,
  "reasoning": "<brief explanation for your score>"
}
```

The `reasoning` field is omitted from the schema instruction when `includeReasoning` is false.

### Response Parsing

- Use existing `repairAndParseJson()` pipeline
- Validate against a ranked-response Zod schema
- Clamp score to `[scaleMin, scaleMax]` if out of bounds
- Store score in `parsedJson`, reasoning in `reasoningText`

### Analysis Pipeline

- If `includeReasoning` is true: enqueue `ANALYZE_RESPONSE` using reasoning text
- If `includeReasoning` is false: skip analysis job entirely

## Results Display

### Per-Response

- Score displayed prominently (e.g., "8 / 10")
- Horizontal bar filled proportionally: `(score - min) / (max - min)`
- Bar colored on gradient (red to yellow to green)
- Reasoning text below bar (if enabled)
- Model label for cross-model comparison

### Per-Question Aggregation

- Average score across all models
- Individual model scores listed below
