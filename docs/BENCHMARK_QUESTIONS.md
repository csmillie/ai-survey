# Benchmark Question Types

This document describes the six structured question types used for benchmark surveys. Each type has a discriminated `configJson` shape stored on the `Question` row, and produces a deterministic JSON response format that enables automated scoring and cross-model comparison.

## Question Types

### 1. SINGLE_SELECT

A multiple-choice question with three or more options. Classic survey item.

```jsonc
// configJson
{
  "type": "SINGLE_SELECT",
  "options": [
    { "label": "Very happy", "value": "very_happy", "numericValue": 3 },
    { "label": "Pretty happy", "value": "pretty_happy", "numericValue": 2 },
    { "label": "Not too happy", "value": "not_too_happy", "numericValue": 1 }
  ],
  "allowDontKnow": false  // optional; adds a "dont_know" escape hatch
}
```

**Response format:** `{ "selectedValue": "pretty_happy", "confidence": 75 }`

### 2. BINARY

A yes/no or two-option question. Config enforces exactly two options.

```jsonc
{
  "type": "BINARY",
  "options": [
    { "label": "Yes", "value": "yes", "numericValue": 1 },
    { "label": "No", "value": "no", "numericValue": 0 }
  ],
  "reverseScored": false  // optional; flips normalization direction
}
```

**Response format:** `{ "selectedValue": "yes", "confidence": 90 }`

### 3. FORCED_CHOICE

Exactly two options representing opposite poles of a construct. Used for classic dichotomous social-science items (e.g., trust vs. caution).

```jsonc
{
  "type": "FORCED_CHOICE",
  "options": [
    { "label": "Most people can be trusted", "value": "trust", "numericValue": 1 },
    { "label": "You can't be too careful", "value": "careful", "numericValue": 0 }
  ],
  "poleALabel": "Trusting",   // optional; descriptive label for pole A
  "poleBLabel": "Cautious"    // optional; descriptive label for pole B
}
```

**Response format:** `{ "selectedValue": "trust", "confidence": 60 }`

### 4. LIKERT

An agreement/frequency scale with a fixed number of points (4, 5, or 7).

```jsonc
{
  "type": "LIKERT",
  "points": 5,
  "options": [
    { "label": "Strongly agree", "value": "strongly_agree", "numericValue": 5 },
    { "label": "Agree", "value": "agree", "numericValue": 4 },
    { "label": "Neither agree nor disagree", "value": "neither", "numericValue": 3 },
    { "label": "Disagree", "value": "disagree", "numericValue": 2 },
    { "label": "Strongly disagree", "value": "strongly_disagree", "numericValue": 1 }
  ],
  "reverseScored": false  // optional; flips normalization direction
}
```

**Response format:** `{ "selectedValue": "agree", "confidence": 80 }`

### 5. NUMERIC_SCALE

A continuous numeric scale with defined endpoints and optional anchor labels.

```jsonc
{
  "type": "NUMERIC_SCALE",
  "min": 0,
  "max": 10,
  "minLabel": "Completely dissatisfied",  // optional
  "maxLabel": "Completely satisfied"       // optional
}
```

**Response format:** `{ "score": 7, "confidence": 85 }`

### 6. MATRIX_LIKERT

A battery of items sharing a common stem and response columns. The question stores the stem and column options in `configJson`; individual row items are stored as `MatrixRow` records linked to the question.

```jsonc
// configJson on the Question row
{
  "type": "MATRIX_LIKERT",
  "stem": "How much confidence do you have in the following institutions?",
  "options": [
    { "label": "A great deal", "value": "great_deal", "numericValue": 3 },
    { "label": "Only some", "value": "only_some", "numericValue": 2 },
    { "label": "Hardly any", "value": "hardly_any", "numericValue": 1 }
  ]
}
```

```sql
-- MatrixRow records (separate table)
-- Each row has: rowKey, label, order, optional sourceVariable and constructKey
| rowKey     | label      | order | sourceVariable |
|------------|------------|-------|----------------|
| government | Government | 1     | CONFED         |
| banks      | Banks      | 2     | CONBUS         |
| media      | Media      | 3     | CONPRESS       |
```

**Response format (per row):** `{ "selectedValue": "only_some", "confidence": 70 }`

## Scoring and Normalization

All benchmark responses are normalized to a **0-1 float** for cross-type comparison:

- **Categorical types** (SINGLE_SELECT, BINARY, FORCED_CHOICE, LIKERT, MATRIX_LIKERT): The selected option's `numericValue` (or ordinal index if `numericValue` is absent) is linearly mapped from the option range to [0, 1]. If `reverseScored` is true, the mapping is inverted.

- **NUMERIC_SCALE**: The raw `score` is linearly mapped from `[min, max]` to `[0, 1]`:
  ```
  normalizedScore = (score - min) / (max - min)
  ```

The normalized score is stored on `LlmResponse.normalizedScore`, and the raw selected value on `LlmResponse.selectedOptionValue` (categorical) or in `parsedJson` (numeric).

## Matrix Row Expansion in Allocation

When the allocation engine encounters a `MATRIX_LIKERT` question, it expands it into **one job per matrix row per model**. For a question with 5 rows run against 4 models, this produces 20 jobs (not 4).

Each expanded job receives:
- A unique `idempotencyKey` that includes the `rowKey`: `{runId}:{modelTargetId}:{questionId}:{rowKey}`
- A unique `threadKey` with the same structure
- Payload fields `matrixRowKey` and `matrixRowLabel` identifying which row to prompt about
- Forced `STATELESS` mode (matrix rows are always independent prompts)

The `promptTemplate` on the question typically includes a `{{institution}}` (or similar) placeholder that the prompt builder replaces with the row label at execution time.

## Deterministic Benchmark Mode

When a survey has `isBenchmarkInstrument: true`, execution uses a **deterministic benchmark mode**:

- The system prompt is replaced with a standardized benchmark system prompt instructing the model to respond only with valid JSON in the specified format.
- Each question type has a dedicated enforcement block builder (in `src/lib/benchmark-prompts.ts`) that constructs a precise prompt listing the allowed option values and the exact JSON schema the model must return.
- Temperature is typically set to 0 to maximize reproducibility across runs.
- Responses are validated against the question's config: the `selectedValue` must be one of the declared option values (categorical types), or the `score` must fall within `[min, max]` (numeric scale).

This mode enables reliable cross-model comparison on established social-science instruments without relying on free-text parsing.
