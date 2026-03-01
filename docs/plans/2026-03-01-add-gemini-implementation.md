# Add Google Gemini Provider — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Google Gemini as a fully functional LLM provider alongside OpenAI and Anthropic.

**Architecture:** Implement the `LlmProvider` adapter using the `@google/genai` SDK, wire it into the existing registry, add env config, and seed two Gemini model targets. Follows the same patterns as the Anthropic provider (system messages separated into `systemInstruction`).

**Tech Stack:** `@google/genai` SDK, TypeScript, Prisma seed.

---

### Task 1: Install @google/genai dependency

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run: `pnpm add @google/genai`

**Step 2: Verify installation**

Run: `pnpm tsc --noEmit`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @google/genai dependency"
```

---

### Task 2: Add env config for Gemini API key

**Files:**
- Modify: `src/lib/env.ts:74` (after `getAnthropicApiKey`)
- Modify: `.env.example:14` (after `ANTHROPIC_API_KEY`)
- Modify: `.env` (add your actual key)

**Step 1: Add env accessor functions**

In `src/lib/env.ts`, after `getAnthropicApiKey()` (line 74), add:

```typescript
export function getGeminiApiKey(): string {
  return requiredEnv("GEMINI_API_KEY");
}
```

After `getWorkerConcurrencyAnthropic()` (line 82), add:

```typescript
export function getWorkerConcurrencyGemini(): number {
  return optionalEnvInt("WORKER_CONCURRENCY_GEMINI", 5);
}
```

**Step 2: Update .env.example**

After `ANTHROPIC_API_KEY=""`, add:

```
GEMINI_API_KEY=""
```

After `WORKER_CONCURRENCY_ANTHROPIC=3`, add:

```
WORKER_CONCURRENCY_GEMINI=5
```

**Step 3: Add actual key to .env**

Add `GEMINI_API_KEY="your-actual-key"` to `.env` (gitignored).

**Step 4: Verify**

Run: `pnpm tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/env.ts .env.example
git commit -m "feat: add Gemini API key env config"
```

---

### Task 3: Implement the Gemini provider adapter

**Files:**
- Create: `src/providers/gemini.ts`
- Modify: `src/providers/stubs.ts` (remove GeminiProvider stub)
- Modify: `src/providers/registry.ts:4-8,24-25` (import from gemini.ts, inject API key)

**Step 1: Create `src/providers/gemini.ts`**

Model the implementation on `src/providers/anthropic.ts`. Key differences:
- SDK: `GoogleGenAI` from `@google/genai`
- System messages go to `config.systemInstruction` (joined with `\n\n`, same as Anthropic)
- User messages use `role: "user"`, assistant messages use `role: "model"` (NOT "assistant")
- Message content uses `parts: [{ text }]` format
- API call: `this.client.models.generateContent({ model, contents, config })`
- Response text: `response.text`
- Token usage: `response.usageMetadata?.promptTokenCount` and `response.usageMetadata?.candidatesTokenCount`

```typescript
import { GoogleGenAI } from "@google/genai";
import type {
  LlmProvider,
  LlmRequestOptions,
  LlmRawResponse,
  LlmMessage,
} from "./types";

export class GeminiProvider implements LlmProvider {
  public readonly name = "gemini";
  private readonly client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async sendRequest(options: LlmRequestOptions): Promise<LlmRawResponse> {
    const start = Date.now();

    const systemMessages: LlmMessage[] = [];
    const conversationMessages: LlmMessage[] = [];

    for (const msg of options.messages) {
      if (msg.role === "system") {
        systemMessages.push(msg);
      } else {
        conversationMessages.push(msg);
      }
    }

    const systemText = systemMessages.map((m) => m.content).join("\n\n");

    const response = await this.client.models.generateContent({
      model: options.model,
      contents: conversationMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: {
        maxOutputTokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        ...(systemText.length > 0 ? { systemInstruction: systemText } : {}),
      },
    });

    const latencyMs = Date.now() - start;

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned no text content");
    }

    return {
      text,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      },
      latencyMs,
    };
  }
}
```

**Step 2: Remove GeminiProvider from stubs.ts**

In `src/providers/stubs.ts`, remove the `GeminiProvider` class (lines 7-13). Keep `PerplexityProvider` and `CopilotProvider`.

**Step 3: Update registry.ts**

Change imports (line 4-8):
```typescript
import { GeminiProvider } from "./gemini";
import {
  PerplexityProvider,
  CopilotProvider,
} from "./stubs";
import { getOpenaiApiKey, getAnthropicApiKey, getGeminiApiKey } from "@/lib/env";
```

Update the GEMINI case (line 24-25):
```typescript
    case "GEMINI":
      return new GeminiProvider(getGeminiApiKey());
```

**Step 4: Verify**

Run: `pnpm tsc --noEmit`
Expected: PASS

Run: `pnpm lint`
Expected: PASS (no new errors)

**Step 5: Commit**

```bash
git add src/providers/gemini.ts src/providers/stubs.ts src/providers/registry.ts
git commit -m "feat: implement Gemini provider adapter"
```

---

### Task 4: Seed Gemini model targets

**Files:**
- Modify: `prisma/seed.ts:62` (after the Anthropic models in the modelTargets array)

**Step 1: Add Gemini models to the seed array**

After the `claude-opus-4-20250514` entry (line 62), add:

```typescript
    {
      provider: "GEMINI" as const,
      modelName: "gemini-2.0-flash",
      isEnabled: true,
      isDefaultCostEffective: true,
      inputTokenCostUsd: 0.0001,
      outputTokenCostUsd: 0.0004,
    },
    {
      provider: "GEMINI" as const,
      modelName: "gemini-2.5-pro",
      isEnabled: true,
      isDefaultCostEffective: false,
      inputTokenCostUsd: 0.00125,
      outputTokenCostUsd: 0.01,
    },
```

**Step 2: Run seed to verify**

Run: `pnpm seed`
Expected: Output includes `ModelTarget GEMINI/gemini-2.0-flash` and `ModelTarget GEMINI/gemini-2.5-pro` upserted.

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed Gemini model targets"
```

---

### Task 5: Run all checks and final commit

**Step 1: Run full check suite**

```bash
pnpm lint
pnpm tsc --noEmit
pnpm test
```

Expected: All pass.

**Step 2: Verify end-to-end (manual)**

1. Start the app: `pnpm dev`
2. Go to the run config page for any survey
3. Verify Gemini models appear in the model selector
4. (Optional) Run a survey with a Gemini model to confirm responses come back
