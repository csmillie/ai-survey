# Ranked Questions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Ranked" question type that asks LLMs to score responses on a configurable numeric scale with optional reasoning.

**Architecture:** New `QuestionType` enum + `configJson` column on Question model for scale config. Execution handler branches on question type to use different system prompts and JSON schemas. Separate `reasoningText` column on LlmResponse stores reasoning. Results page renders ranked responses with score bars.

**Tech Stack:** Prisma (MySQL), Zod, Next.js App Router (Server Actions + Client Components), Vitest

---

### Task 1: Prisma Schema — Add QuestionType enum and new fields

**Files:**
- Modify: `prisma/schema.prisma:23-26` (add enum after QuestionMode)
- Modify: `prisma/schema.prisma:128-144` (add fields to Question model)
- Modify: `prisma/schema.prisma:246-267` (add reasoningText to LlmResponse)

**Step 1: Add QuestionType enum to schema**

In `prisma/schema.prisma`, after the `QuestionMode` enum (line 26), add:

```prisma
enum QuestionType {
  OPEN_ENDED
  RANKED
}
```

**Step 2: Add type and configJson fields to Question model**

In the `Question` model (line 128-144), add after `promptTemplate`:

```prisma
  type            QuestionType @default(OPEN_ENDED)
  configJson      Json?
```

**Step 3: Add reasoningText to LlmResponse model**

In the `LlmResponse` model (line 246-267), add after `parsedJson`:

```prisma
  reasoningText   String?      @db.Text
```

**Step 4: Run migration**

Run: `pnpm prisma:migrate --name add-ranked-question-type`
Expected: Migration created and applied successfully.

**Step 5: Generate Prisma client**

Run: `pnpm prisma:generate`
Expected: Prisma client generated with new types.

**Step 6: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors (existing code doesn't reference new fields yet).

**Step 7: Commit**

```bash
git add prisma/
git commit -m "feat: add QuestionType enum, configJson, and reasoningText to schema"
```

---

### Task 2: Zod Schemas — Add ranked question config and response schemas

**Files:**
- Modify: `src/lib/schemas.ts:78-94` (extend question schemas)

**Step 1: Write test for ranked config schema validation**

Create `src/__tests__/schemas-ranked.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  rankedConfigSchema,
  rankedResponseSchema,
  createQuestionSchema,
} from "@/lib/schemas";

describe("rankedConfigSchema", () => {
  it("accepts valid ranked config with 1-5 preset", () => {
    const result = rankedConfigSchema.safeParse({
      scalePreset: "1-5",
      scaleMin: 1,
      scaleMax: 5,
      includeReasoning: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts percentage preset with 0-100 range", () => {
    const result = rankedConfigSchema.safeParse({
      scalePreset: "percentage",
      scaleMin: 0,
      scaleMax: 100,
      includeReasoning: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts custom min/max overriding preset defaults", () => {
    const result = rankedConfigSchema.safeParse({
      scalePreset: "1-5",
      scaleMin: 2,
      scaleMax: 4,
      includeReasoning: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid preset", () => {
    const result = rankedConfigSchema.safeParse({
      scalePreset: "1-50",
      scaleMin: 1,
      scaleMax: 50,
      includeReasoning: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when scaleMin >= scaleMax", () => {
    const result = rankedConfigSchema.safeParse({
      scalePreset: "1-5",
      scaleMin: 5,
      scaleMax: 5,
      includeReasoning: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative scaleMin", () => {
    const result = rankedConfigSchema.safeParse({
      scalePreset: "1-5",
      scaleMin: -1,
      scaleMax: 5,
      includeReasoning: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("rankedResponseSchema", () => {
  it("accepts score only", () => {
    const result = rankedResponseSchema.safeParse({ score: 7 });
    expect(result.success).toBe(true);
  });

  it("accepts score with reasoning", () => {
    const result = rankedResponseSchema.safeParse({
      score: 3,
      reasoning: "Because it was average",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing score", () => {
    const result = rankedResponseSchema.safeParse({
      reasoning: "No score given",
    });
    expect(result.success).toBe(false);
  });
});

describe("createQuestionSchema with type", () => {
  it("accepts OPEN_ENDED type without configJson", () => {
    const result = createQuestionSchema.safeParse({
      title: "Test",
      promptTemplate: "What do you think?",
      type: "OPEN_ENDED",
    });
    expect(result.success).toBe(true);
  });

  it("accepts RANKED type with configJson", () => {
    const result = createQuestionSchema.safeParse({
      title: "Test",
      promptTemplate: "Rate {{brand}}",
      type: "RANKED",
      configJson: {
        scalePreset: "1-10",
        scaleMin: 1,
        scaleMax: 10,
        includeReasoning: true,
      },
    });
    expect(result.success).toBe(true);
  });

  it("defaults type to OPEN_ENDED when omitted", () => {
    const result = createQuestionSchema.safeParse({
      title: "Test",
      promptTemplate: "What do you think?",
    });
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/schemas-ranked.test.ts`
Expected: FAIL — `rankedConfigSchema` and `rankedResponseSchema` not exported.

**Step 3: Add schemas to src/lib/schemas.ts**

In `src/lib/schemas.ts`, add after the existing question schemas section (after line 94):

```typescript
// ---------------------------------------------------------------------------
// Ranked Question Config
// ---------------------------------------------------------------------------

export const SCALE_PRESETS = {
  "1-5": { min: 1, max: 5 },
  "1-10": { min: 1, max: 10 },
  "1-100": { min: 1, max: 100 },
  "percentage": { min: 0, max: 100 },
} as const;

export type ScalePreset = keyof typeof SCALE_PRESETS;

export const rankedConfigSchema = z.object({
  scalePreset: z.enum(["1-5", "1-10", "1-100", "percentage"]),
  scaleMin: z.number().int().min(0),
  scaleMax: z.number().int().min(1),
  includeReasoning: z.boolean(),
}).refine((data) => data.scaleMin < data.scaleMax, {
  message: "scaleMin must be less than scaleMax",
  path: ["scaleMin"],
});

export type RankedConfig = z.infer<typeof rankedConfigSchema>;

export const rankedResponseSchema = z.object({
  score: z.number(),
  reasoning: z.string().optional(),
});

export type RankedResponsePayload = z.infer<typeof rankedResponseSchema>;
```

Also update the `createQuestionSchema` (lines 82-88) to include the new fields:

```typescript
export const createQuestionSchema = z.object({
  title: z.string(),
  promptTemplate: z.string(),
  mode: z.enum(["STATELESS", "THREADED"]).optional(),
  threadKey: z.string().optional(),
  order: z.number().int().optional(),
  type: z.enum(["OPEN_ENDED", "RANKED"]).optional(),
  configJson: rankedConfigSchema.optional(),
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/schemas-ranked.test.ts`
Expected: All tests PASS.

**Step 5: Run all tests**

Run: `pnpm test`
Expected: All tests PASS (existing tests unaffected).

**Step 6: Commit**

```bash
git add src/lib/schemas.ts src/__tests__/schemas-ranked.test.ts
git commit -m "feat: add Zod schemas for ranked question config and response"
```

---

### Task 3: Ranked Prompt Builder — Create prompt construction utility

**Files:**
- Create: `src/lib/ranked-prompt.ts`
- Create: `src/__tests__/ranked-prompt.test.ts`

**Step 1: Write tests for the ranked prompt builder**

Create `src/__tests__/ranked-prompt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildRankedSystemPrompt,
  buildRankedEnforcementBlock,
  clampScore,
} from "@/lib/ranked-prompt";

describe("buildRankedSystemPrompt", () => {
  it("returns the evaluator system prompt", () => {
    const prompt = buildRankedSystemPrompt();
    expect(prompt).toContain("research evaluator");
    expect(prompt).toContain("numeric scale");
  });
});

describe("buildRankedEnforcementBlock", () => {
  it("includes score range in the enforcement block", () => {
    const block = buildRankedEnforcementBlock({
      scaleMin: 1,
      scaleMax: 10,
      includeReasoning: true,
    });
    expect(block).toContain("1");
    expect(block).toContain("10");
    expect(block).toContain('"score"');
    expect(block).toContain('"reasoning"');
  });

  it("omits reasoning field when includeReasoning is false", () => {
    const block = buildRankedEnforcementBlock({
      scaleMin: 1,
      scaleMax: 5,
      includeReasoning: false,
    });
    expect(block).toContain('"score"');
    expect(block).not.toContain('"reasoning"');
  });

  it("works with percentage scale (0-100)", () => {
    const block = buildRankedEnforcementBlock({
      scaleMin: 0,
      scaleMax: 100,
      includeReasoning: false,
    });
    expect(block).toContain("0");
    expect(block).toContain("100");
  });
});

describe("clampScore", () => {
  it("returns score unchanged when within range", () => {
    expect(clampScore(5, 1, 10)).toBe(5);
  });

  it("clamps score below min to min", () => {
    expect(clampScore(-1, 0, 10)).toBe(0);
  });

  it("clamps score above max to max", () => {
    expect(clampScore(15, 1, 10)).toBe(10);
  });

  it("handles boundary values", () => {
    expect(clampScore(1, 1, 10)).toBe(1);
    expect(clampScore(10, 1, 10)).toBe(10);
  });

  it("rounds non-integer scores to nearest integer", () => {
    expect(clampScore(3.7, 1, 5)).toBe(4);
    expect(clampScore(3.2, 1, 5)).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/ranked-prompt.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement the ranked prompt builder**

Create `src/lib/ranked-prompt.ts`:

```typescript
// ---------------------------------------------------------------------------
// Ranked Question Prompt Utilities
// ---------------------------------------------------------------------------

/**
 * System prompt used for ranked/scored questions.
 */
export function buildRankedSystemPrompt(): string {
  return "You are a research evaluator. You will be asked to rate something on a numeric scale. Respond ONLY with valid JSON in the exact format specified. Do not include any text outside the JSON.";
}

/**
 * Build the JSON enforcement block appended to ranked question prompts.
 */
export function buildRankedEnforcementBlock(config: {
  scaleMin: number;
  scaleMax: number;
  includeReasoning: boolean;
}): string {
  const { scaleMin, scaleMax, includeReasoning } = config;

  const schemaFields = includeReasoning
    ? `{
  "score": <integer from ${scaleMin} to ${scaleMax}>,
  "reasoning": "<brief explanation for your score>"
}`
    : `{
  "score": <integer from ${scaleMin} to ${scaleMax}>
}`;

  return `\n\n---\nRate your response on a scale from ${scaleMin} to ${scaleMax}.\n\nRespond with ONLY valid JSON matching this schema:\n${schemaFields}\n\nDo not wrap the JSON in markdown code fences.\n---`;
}

/**
 * Clamp and round a score to the valid range.
 */
export function clampScore(score: number, min: number, max: number): number {
  const rounded = Math.round(score);
  return Math.max(min, Math.min(max, rounded));
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/ranked-prompt.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/lib/ranked-prompt.ts src/__tests__/ranked-prompt.test.ts
git commit -m "feat: add ranked prompt builder utility with tests"
```

---

### Task 4: Server Actions — Update addQuestion and updateQuestion for ranked type

**Files:**
- Modify: `src/app/app/surveys/[surveyId]/actions.ts:77-130` (addQuestionAction)
- Modify: `src/app/app/surveys/[surveyId]/actions.ts:132-172` (updateQuestionAction)

**Step 1: Update addQuestionAction to handle type and configJson**

In `src/app/app/surveys/[surveyId]/actions.ts`, update `addQuestionAction` (line 77-130).

Change the raw object construction (lines 90-95) to include the new fields:

```typescript
  const typeRaw = formData.get("type");
  const configJsonRaw = formData.get("configJson");

  const raw = {
    title,
    promptTemplate,
    mode: formData.get("mode") || undefined,
    threadKey: formData.get("threadKey") || undefined,
    type: (typeof typeRaw === "string" && typeRaw) ? typeRaw : undefined,
    configJson: typeof configJsonRaw === "string" && configJsonRaw
      ? JSON.parse(configJsonRaw) as unknown
      : undefined,
  };
```

Update the `prisma.question.create` call (lines 109-118) to include the new fields:

```typescript
  const question = await prisma.question.create({
    data: {
      surveyId,
      title: parsed.data.title,
      promptTemplate: parsed.data.promptTemplate,
      mode: parsed.data.mode ?? "STATELESS",
      threadKey: parsed.data.threadKey,
      order: nextOrder,
      type: parsed.data.type ?? "OPEN_ENDED",
      configJson: parsed.data.configJson
        ? (parsed.data.configJson as unknown as Prisma.InputJsonValue)
        : undefined,
    },
  });
```

Add `Prisma` import at the top:

```typescript
import { Prisma } from "@prisma/client";
```

**Step 2: Update updateQuestionAction to handle type and configJson**

In `updateQuestionAction` (lines 132-172), update the raw object construction (around line 140):

```typescript
  const type = formData.get("type");
  const configJson = formData.get("configJson");

  if (typeof type === "string" && type) raw.type = type;
  if (typeof configJson === "string" && configJson)
    raw.configJson = JSON.parse(configJson) as unknown;
```

Update the `prisma.question.update` call to handle configJson:

```typescript
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.configJson) {
    updateData.configJson = parsed.data.configJson as unknown as Prisma.InputJsonValue;
  }

  await prisma.question.update({
    where: { id: questionId, surveyId },
    data: updateData,
  });
```

**Step 3: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/app/app/surveys/[surveyId]/actions.ts
git commit -m "feat: update question server actions to handle ranked type and configJson"
```

---

### Task 5: Allocation Engine — Pass question type and config to job payload

**Files:**
- Modify: `src/lib/allocation.ts:84-98` (payloadJson construction)

**Step 1: Write test for allocation with ranked questions**

Add to `src/__tests__/allocation.test.ts` a new test:

```typescript
it("includes questionType and config in payload for RANKED questions", async () => {
  const rankedQuestion = {
    ...makeQuestion("q-ranked", 0, "Rate {{brand}}"),
    type: "RANKED" as const,
    configJson: {
      scalePreset: "1-10",
      scaleMin: 1,
      scaleMax: 10,
      includeReasoning: true,
    },
  };

  vi.mocked(prisma.question.findMany).mockResolvedValue([rankedQuestion]);
  vi.mocked(prisma.variable.findMany).mockResolvedValue([]);

  const result = await allocateJobs({
    runId: RUN_ID,
    surveyId: SURVEY_ID,
    modelTargetIds: [MODEL_A],
  });

  expect(result.jobs[0].payloadJson).toMatchObject({
    questionType: "RANKED",
    questionConfig: {
      scalePreset: "1-10",
      scaleMin: 1,
      scaleMax: 10,
      includeReasoning: true,
    },
  });
});

it("sets questionType to OPEN_ENDED for standard questions", async () => {
  vi.mocked(prisma.question.findMany).mockResolvedValue([
    makeQuestion("q1", 0, "Tell me about {{brand}}"),
  ]);
  vi.mocked(prisma.variable.findMany).mockResolvedValue([]);

  const result = await allocateJobs({
    runId: RUN_ID,
    surveyId: SURVEY_ID,
    modelTargetIds: [MODEL_A],
  });

  expect(result.jobs[0].payloadJson).toMatchObject({
    questionType: "OPEN_ENDED",
  });
  expect(result.jobs[0].payloadJson).not.toHaveProperty("questionConfig");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/allocation.test.ts`
Expected: FAIL — payload doesn't have `questionType`.

**Step 3: Update allocation.ts to include question type info**

In `src/lib/allocation.ts`, update the payloadJson construction (lines 91-97):

```typescript
        payloadJson: {
          questionTitle: question.title,
          renderedPrompt,
          questionMode: question.mode,
          threadKey,
          variableValues: variableMap,
          questionType: question.type ?? "OPEN_ENDED",
          ...(question.configJson ? { questionConfig: question.configJson } : {}),
        },
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/allocation.test.ts`
Expected: All tests PASS.

**Step 5: Update ExecuteQuestionPayload type**

In `src/lib/queue.ts`, add new fields to `ExecuteQuestionPayload` (line 18-26):

```typescript
export interface ExecuteQuestionPayload {
  jobId: string;
  runId: string;
  modelTargetId: string;
  questionId: string;
  threadKey: string;
  renderedPrompt: string;
  questionMode: string;
  questionType?: string;
  questionConfig?: {
    scalePreset: string;
    scaleMin: number;
    scaleMax: number;
    includeReasoning: boolean;
  };
}
```

**Step 6: Run all tests**

Run: `pnpm test`
Expected: All tests PASS.

**Step 7: Commit**

```bash
git add src/lib/allocation.ts src/lib/queue.ts src/__tests__/allocation.test.ts
git commit -m "feat: pass question type and config through allocation to job payload"
```

---

### Task 6: Execute Question Handler — Branch on question type

**Files:**
- Modify: `src/worker/handlers/execute-question.ts:30-205`

**Step 1: Update handler to branch on question type**

In `src/worker/handlers/execute-question.ts`:

Add imports at top:

```typescript
import {
  buildRankedSystemPrompt,
  buildRankedEnforcementBlock,
  clampScore,
} from "@/lib/ranked-prompt";
import { rankedResponseSchema } from "@/lib/schemas";
```

Update the payload destructuring (lines 33-41) to include new fields:

```typescript
  const {
    jobId,
    runId,
    modelTargetId,
    questionId,
    threadKey,
    renderedPrompt,
    questionMode,
    questionType,
    questionConfig,
  } = payload;
```

Update the system prompt selection (lines 50-56):

```typescript
    const isRanked = questionType === "RANKED" && questionConfig;

    const messages: LlmMessage[] = [
      {
        role: "system",
        content: isRanked
          ? buildRankedSystemPrompt()
          : "You are a research assistant. Answer questions accurately with citations.",
      },
    ];
```

Update the user content construction (lines 74-76):

```typescript
    const userContent = isRanked
      ? renderedPrompt + buildRankedEnforcementBlock({
          scaleMin: questionConfig!.scaleMin,
          scaleMax: questionConfig!.scaleMax,
          includeReasoning: questionConfig!.includeReasoning,
        })
      : renderedPrompt + JSON_ENFORCEMENT_BLOCK;
```

Update the response parsing and LlmResponse creation (lines 86-116).

After the existing `repairAndParseJson` call, add ranked-specific parsing:

```typescript
    // 4. Parse response
    const { parsed, error: parseError } = repairAndParseJson(response.text);

    let reasoningText: string | null = null;

    if (isRanked && parsed) {
      const rankedResult = rankedResponseSchema.safeParse(parsed);
      if (rankedResult.success) {
        const clamped = clampScore(
          rankedResult.data.score,
          questionConfig!.scaleMin,
          questionConfig!.scaleMax,
        );
        (parsed as Record<string, unknown>).score = clamped;
        reasoningText = rankedResult.data.reasoning ?? null;
      }
    }

    const typedParsed = parsed as Record<string, unknown> | null;
```

Update the LlmResponse create to include reasoningText:

```typescript
    const llmResponse = await prisma.llmResponse.create({
      data: {
        runId,
        modelTargetId,
        questionId,
        threadKey,
        rawText: response.text,
        parsedJson: typedParsed
          ? (typedParsed as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        citationsJson: !isRanked && typedParsed && "citations" in typedParsed
          ? (typedParsed.citations as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        reasoningText,
        usageJson: response.usage as unknown as Prisma.InputJsonValue,
        costUsd,
        latencyMs: response.latencyMs,
      },
    });
```

Update the analysis enqueue logic (lines 166-171) to conditionally skip:

```typescript
    // 9. Enqueue ANALYZE_RESPONSE job (skip for ranked without reasoning)
    const shouldAnalyze = !isRanked || (isRanked && questionConfig?.includeReasoning);
    if (shouldAnalyze) {
      await enqueueAnalyzeJob({
        runId,
        responseId: llmResponse.id,
        modelTargetId,
      });
    }
```

**Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors.

**Step 3: Run all tests**

Run: `pnpm test`
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add src/worker/handlers/execute-question.ts
git commit -m "feat: branch execution handler on question type for ranked scoring"
```

---

### Task 7: Analyze Response Handler — Use reasoning text for ranked questions

**Files:**
- Modify: `src/worker/handlers/analyze-response.ts:25-117`

**Step 1: Update handler to use reasoningText for ranked questions**

In `src/worker/handlers/analyze-response.ts`, update the text extraction logic (lines 54-67).

Replace the section that extracts `answerText` with:

```typescript
    // 3. Extract text to analyze
    const parsed = llmResponse.parsedJson as unknown as Record<string, unknown>;
    // For ranked questions, analyze the reasoning text; for open-ended, analyze answerText
    const textToAnalyze = llmResponse.reasoningText
      ?? (parsed as ParsedLlmResponse).answerText
      ?? "";

    if (!textToAnalyze) {
      await prisma.analysisResult.create({
        data: {
          responseId,
          flagsJson: ["empty_answer"] as unknown as Prisma.InputJsonValue,
        },
      });
      await markJobSucceeded(jobId);
      return;
    }
```

Then update the analysis calls (lines 69-73) to use `textToAnalyze`:

```typescript
    const sentimentScore = analyzeSentiment(textToAnalyze);
    const entities = extractEntities(textToAnalyze);
    const brandMentions = extractBrandMentions(textToAnalyze);
    const institutionMentions = extractInstitutionMentions(textToAnalyze);
```

Also update the flags section to use `textToAnalyze`:

```typescript
    if (textToAnalyze.length < 20) {
      flags.push("short_answer");
    }
```

**Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/worker/handlers/analyze-response.ts
git commit -m "feat: analyze reasoning text for ranked questions"
```

---

### Task 8: Survey Builder UI — Update question dialog for type selection

**Files:**
- Modify: `src/app/app/surveys/[surveyId]/survey-builder.tsx:50-58` (QuestionData interface)
- Modify: `src/app/app/surveys/[surveyId]/survey-builder.tsx:308-459` (QuestionsTab)

**Step 1: Update QuestionData interface**

In `survey-builder.tsx`, update the `QuestionData` interface (lines 51-58):

```typescript
interface QuestionData {
  id: string;
  title: string;
  promptTemplate: string;
  mode: string;
  threadKey: string | null;
  order: number;
  type: string;
  configJson: {
    scalePreset: string;
    scaleMin: number;
    scaleMax: number;
    includeReasoning: boolean;
  } | null;
}
```

**Step 2: Update the page.tsx server component to pass new fields**

Check `src/app/app/surveys/[surveyId]/page.tsx` — ensure the question query includes the `type` and `configJson` fields. Since Prisma includes all scalar fields by default, this should already work. But the transformation mapping the questions to `QuestionData` needs updating if there is one.

**Step 3: Update the Add Question dialog**

In the `QuestionsTab` component (around lines 348-389), update the form in the dialog to include type selection and ranked configuration.

Replace the existing form content with:

```tsx
<form ref={addFormRef} action={handleAddQuestion} className="space-y-4">
  {/* Question Type Selector */}
  <div className="space-y-2">
    <Label>Question Type</Label>
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant={questionType === "OPEN_ENDED" ? "default" : "outline"}
        onClick={() => setQuestionType("OPEN_ENDED")}
      >
        Open Ended
      </Button>
      <Button
        type="button"
        size="sm"
        variant={questionType === "RANKED" ? "default" : "outline"}
        onClick={() => setQuestionType("RANKED")}
      >
        Ranked
      </Button>
    </div>
    <input type="hidden" name="type" value={questionType} />
  </div>

  {/* Prompt Template */}
  <div className="space-y-2">
    <Label htmlFor="q-prompt">Question</Label>
    <Textarea
      id="q-prompt"
      name="promptTemplate"
      placeholder={questionType === "RANKED"
        ? "e.g., How would you rate {{brand}} for customer satisfaction?"
        : "e.g., What do you think about {{brand}}?"}
      rows={4}
      required
    />
    <p className="text-xs text-[hsl(var(--muted-foreground))]">
      Use {"{{variable_name}}"} syntax for variable substitution.
    </p>
  </div>

  {/* Ranked Configuration */}
  {questionType === "RANKED" && (
    <RankedConfigFields
      scalePreset={scalePreset}
      scaleMin={scaleMin}
      scaleMax={scaleMax}
      includeReasoning={includeReasoning}
      onPresetChange={(preset) => {
        setScalePreset(preset);
        const defaults = PRESET_DEFAULTS[preset];
        setScaleMin(defaults.min);
        setScaleMax(defaults.max);
      }}
      onMinChange={setScaleMin}
      onMaxChange={setScaleMax}
      onReasoningChange={setIncludeReasoning}
    />
  )}

  {/* Mode */}
  <div className="space-y-2">
    <Label htmlFor="q-mode">Mode</Label>
    <Select id="q-mode" name="mode" defaultValue="STATELESS">
      <SelectOption value="STATELESS">Stateless</SelectOption>
      <SelectOption value="THREADED">Threaded</SelectOption>
    </Select>
  </div>

  {/* Thread Key */}
  <div className="space-y-2">
    <Label htmlFor="q-threadKey">Thread Key (optional)</Label>
    <Input id="q-threadKey" name="threadKey" placeholder="e.g., main-thread" />
  </div>

  <DialogFooter>
    <Button type="button" variant="ghost" onClick={() => setAddDialogOpen(false)}>
      Cancel
    </Button>
    <Button type="submit">Add Question</Button>
  </DialogFooter>
</form>
```

**Step 4: Add state variables to QuestionsTab**

Add these state variables inside the `QuestionsTab` component:

```typescript
const [questionType, setQuestionType] = useState<"OPEN_ENDED" | "RANKED">("OPEN_ENDED");
const [scalePreset, setScalePreset] = useState<string>("1-5");
const [scaleMin, setScaleMin] = useState(1);
const [scaleMax, setScaleMax] = useState(5);
const [includeReasoning, setIncludeReasoning] = useState(true);

const PRESET_DEFAULTS: Record<string, { min: number; max: number }> = {
  "1-5": { min: 1, max: 5 },
  "1-10": { min: 1, max: 10 },
  "1-100": { min: 1, max: 100 },
  "percentage": { min: 0, max: 100 },
};
```

**Step 5: Update handleAddQuestion to serialize configJson**

In the `handleAddQuestion` function, update to serialize the ranked config before form submission. Since we're using FormData (server actions), we need to inject the configJson as a hidden field.

Add a hidden input inside the form when `questionType === "RANKED"`:

```tsx
{questionType === "RANKED" && (
  <input
    type="hidden"
    name="configJson"
    value={JSON.stringify({
      scalePreset,
      scaleMin,
      scaleMax,
      includeReasoning,
    })}
  />
)}
```

**Step 6: Create RankedConfigFields component**

Add this component at the bottom of `survey-builder.tsx` (before the sharing section):

```tsx
function RankedConfigFields({
  scalePreset,
  scaleMin,
  scaleMax,
  includeReasoning,
  onPresetChange,
  onMinChange,
  onMaxChange,
  onReasoningChange,
}: {
  scalePreset: string;
  scaleMin: number;
  scaleMax: number;
  includeReasoning: boolean;
  onPresetChange: (preset: string) => void;
  onMinChange: (min: number) => void;
  onMaxChange: (max: number) => void;
  onReasoningChange: (include: boolean) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <h4 className="text-sm font-medium">Scale Configuration</h4>
      <div className="space-y-2">
        <Label htmlFor="q-preset">Preset</Label>
        <Select
          id="q-preset"
          value={scalePreset}
          onChange={(e) => onPresetChange(e.target.value)}
        >
          <SelectOption value="1-5">1 to 5</SelectOption>
          <SelectOption value="1-10">1 to 10</SelectOption>
          <SelectOption value="1-100">1 to 100</SelectOption>
          <SelectOption value="percentage">Percentage (0-100)</SelectOption>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="q-min">Min</Label>
          <Input
            id="q-min"
            type="number"
            value={scaleMin}
            onChange={(e) => onMinChange(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="q-max">Max</Label>
          <Input
            id="q-max"
            type="number"
            value={scaleMax}
            onChange={(e) => onMaxChange(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="q-reasoning"
          type="checkbox"
          checked={includeReasoning}
          onChange={(e) => onReasoningChange(e.target.checked)}
          className="h-4 w-4 rounded border-[hsl(var(--border))]"
        />
        <Label htmlFor="q-reasoning" className="text-sm font-normal">
          Include reasoning
        </Label>
      </div>
    </div>
  );
}
```

**Step 7: Update question list to show type badge**

In the question table rows (around line 428-434), add a Type column:

Add to the TableHeader:
```tsx
<TableHead>Type</TableHead>
```

Add to the TableRow cells after the Mode badge:
```tsx
<TableCell>
  <Badge variant="outline">
    {q.type === "RANKED" && q.configJson
      ? `Ranked ${q.configJson.scaleMin}-${q.configJson.scaleMax}`
      : "Open Ended"}
  </Badge>
</TableCell>
```

**Step 8: Update the page.tsx to pass type and configJson to QuestionData**

Check `src/app/app/surveys/[surveyId]/page.tsx` — update the question mapping to include `type` and `configJson`.

**Step 9: Update QuestionEditRow to handle ranked config**

Update the `QuestionEditRow` component to include ranked config editing (similar to the add dialog). This includes showing the type selector and `RankedConfigFields` when the type is `RANKED`.

**Step 10: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors.

**Step 11: Commit**

```bash
git add src/app/app/surveys/[surveyId]/survey-builder.tsx src/app/app/surveys/[surveyId]/page.tsx
git commit -m "feat: add ranked question type selector and scale config to survey builder"
```

---

### Task 9: Run Results Page — Render ranked responses with score bars

**Files:**
- Modify: `src/app/app/runs/[runId]/page.tsx:15-18,83-105` (add score/reasoning to transform)
- Modify: `src/app/app/runs/[runId]/run-progress.tsx:28-47,292-501` (add ranked display)

**Step 1: Update page.tsx response transformation**

In `src/app/app/runs/[runId]/page.tsx`, update the `ParsedLlmResponse` interface (lines 15-18) to handle both types:

```typescript
interface ParsedLlmResponse {
  answerText?: string;
  citations?: Array<{ url: string; title?: string; snippet?: string }>;
  score?: number;
  reasoning?: string;
}
```

Update the response mapping (lines 83-105) to include score data and the question type. Load the question's `type` and `configJson`:

Update the include for responses (line 47-48):
```typescript
          question: {
            select: { id: true, title: true, type: true, configJson: true },
          },
```

Update the response mapping:
```typescript
    return {
      id: resp.id,
      questionId: resp.question.id,
      questionTitle: resp.question.title,
      questionType: resp.question.type,
      questionConfig: resp.question.configJson as {
        scaleMin: number;
        scaleMax: number;
      } | null,
      modelName: resp.modelTarget.modelName,
      provider: resp.modelTarget.provider,
      answerText: parsed?.answerText ?? (parsed?.score != null ? "" : resp.rawText),
      score: parsed?.score ?? null,
      reasoningText: resp.reasoningText ?? null,
      citations: parsed?.citations ?? [],
      sentimentScore: resp.analysis?.sentimentScore ?? null,
      costUsd: resp.costUsd?.toString() ?? null,
      latencyMs: resp.latencyMs,
      flags: (resp.analysis?.flagsJson as string[] | null) ?? [],
      brandMentions: (resp.analysis?.brandMentionsJson as string[] | null) ?? [],
      institutionMentions: (resp.analysis?.institutionMentionsJson as string[] | null) ?? [],
      entities: (resp.analysis?.entitiesJson as AnalysisEntities | null) ?? null,
    };
```

**Step 2: Update ResponseData type in run-progress.tsx**

In `src/app/app/runs/[runId]/run-progress.tsx`, update the `ResponseData` interface (lines 28-47):

```typescript
interface ResponseData {
  id: string;
  questionId: string;
  questionTitle: string;
  questionType: string;
  questionConfig: { scaleMin: number; scaleMax: number } | null;
  modelName: string;
  provider: string;
  answerText: string;
  score: number | null;
  reasoningText: string | null;
  citations: Array<{ url: string; title?: string; snippet?: string }>;
  sentimentScore: number | null;
  costUsd: string | null;
  latencyMs: number | null;
  flags: string[];
  brandMentions: string[];
  institutionMentions: string[];
  entities: {
    people: string[];
    places: string[];
    organizations: string[];
  } | null;
}
```

**Step 3: Add ScoreBar component**

Add a new component in `run-progress.tsx`:

```tsx
function ScoreBar({
  score,
  min,
  max,
}: {
  score: number;
  min: number;
  max: number;
}) {
  const percentage = ((score - min) / (max - min)) * 100;

  // Color gradient: red (0%) -> yellow (50%) -> green (100%)
  let colorClass: string;
  if (percentage >= 70) {
    colorClass = "bg-green-500";
  } else if (percentage >= 40) {
    colorClass = "bg-yellow-500";
  } else {
    colorClass = "bg-red-500";
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold whitespace-nowrap">
        {score} / {max}
      </span>
      <div className="h-2 flex-1 rounded-full bg-[hsl(var(--muted))]">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

**Step 4: Update ResponseRow to render differently for ranked questions**

In the `ResponseRow` component (lines 352-501), update to check the question type and render accordingly.

In the summary row (the non-expanded row), replace the Answer cell:

```tsx
<TableCell className="max-w-md">
  {response.score !== null && response.questionConfig ? (
    <ScoreBar
      score={response.score}
      min={response.questionConfig.scaleMin}
      max={response.questionConfig.scaleMax}
    />
  ) : (
    <p className="truncate text-sm">{truncatedAnswer}</p>
  )}
</TableCell>
```

In the expanded section, update to show reasoning for ranked questions:

```tsx
{/* Full answer or reasoning */}
<div>
  <h4 className="mb-1 text-sm font-medium">
    {response.score !== null ? "Score & Reasoning" : "Full Answer"}
  </h4>
  {response.score !== null && response.questionConfig ? (
    <div className="space-y-2">
      <ScoreBar
        score={response.score}
        min={response.questionConfig.scaleMin}
        max={response.questionConfig.scaleMax}
      />
      {response.reasoningText && (
        <p className="whitespace-pre-wrap text-sm text-[hsl(var(--muted-foreground))]">
          {response.reasoningText}
        </p>
      )}
    </div>
  ) : (
    <p className="whitespace-pre-wrap text-sm">
      {response.answerText}
    </p>
  )}
</div>
```

**Step 5: Add average score display per question group**

In the question group card header (around lines 296-301), add average score when it's a ranked question:

```tsx
<CardHeader>
  <CardTitle className="text-lg">{group.questionTitle}</CardTitle>
  <CardDescription>
    {group.responses.length} response{group.responses.length === 1 ? "" : "s"}
    {(() => {
      const scores = group.responses
        .filter((r) => r.score !== null)
        .map((r) => r.score!);
      if (scores.length === 0) return null;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const config = group.responses[0]?.questionConfig;
      return config ? (
        <span className="ml-2 font-medium">
          Avg: {avg.toFixed(1)} / {config.scaleMax}
        </span>
      ) : null;
    })()}
  </CardDescription>
</CardHeader>
```

**Step 6: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors.

**Step 7: Commit**

```bash
git add src/app/app/runs/[runId]/page.tsx src/app/app/runs/[runId]/run-progress.tsx
git commit -m "feat: render ranked responses with score bars and reasoning in results"
```

---

### Task 10: Survey Builder Page — Pass type/configJson from server to client

**Files:**
- Modify: `src/app/app/surveys/[surveyId]/page.tsx` (question mapping)

**Step 1: Update the survey detail page**

Read the file to find how questions are loaded and mapped to the `QuestionData` interface. Update the mapping to include `type` and `configJson`:

```typescript
questions: survey.questions.map((q) => ({
  id: q.id,
  title: q.title,
  promptTemplate: q.promptTemplate,
  mode: q.mode,
  threadKey: q.threadKey,
  order: q.order,
  type: q.type,
  configJson: q.configJson as QuestionData["configJson"],
})),
```

**Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/app/surveys/[surveyId]/page.tsx
git commit -m "feat: pass question type and configJson to survey builder client"
```

---

### Task 11: Pre-commit checks and final verification

**Step 1: Run linter**

Run: `pnpm lint`
Expected: No errors.

**Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors.

**Step 3: Run all tests**

Run: `pnpm test`
Expected: All tests PASS.

**Step 4: Manual smoke test checklist**

- [ ] Start dev server: `pnpm dev`
- [ ] Create a new survey
- [ ] Add an open-ended question — verify it works as before
- [ ] Add a ranked question with "1 to 10" preset
- [ ] Verify min/max fields populate with 1 and 10
- [ ] Change preset to "Percentage" — verify min/max change to 0 and 100
- [ ] Edit min/max manually
- [ ] Toggle "Include reasoning" checkbox
- [ ] Verify question list shows type badges
- [ ] Edit a ranked question — verify config persists
- [ ] Configure a run and start it
- [ ] Verify ranked responses show score bars in results
- [ ] Verify reasoning text appears when included
- [ ] Verify average score shows per question group
