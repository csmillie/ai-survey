# Formatting System Prompt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Append a fixed formatting system prompt to all LLM API calls and set `temperature: 0` and `top_p: 1` on every request.

**Architecture:** Define `FORMATTING_SYSTEM_PROMPT` constant and `topP` field in `types.ts`, wire `topP` through all 4 provider `sendRequest` implementations, then update both call sites (`execute-question.ts` and `referee.ts`) to append the prompt and pass the parameters explicitly.

**Tech Stack:** TypeScript, Vitest (tests), providers: OpenAI SDK, `@anthropic-ai/sdk`, `@google/genai`

---

### Task 1: Add `FORMATTING_SYSTEM_PROMPT` constant and `topP` to types

**Files:**
- Modify: `src/providers/types.ts`

**Step 1: Add the constant and field**

In `src/providers/types.ts`, add after `JSON_ENFORCEMENT_BLOCK`:

```ts
export const FORMATTING_SYSTEM_PROMPT = `You are a formatting engine.
Output exactly what is requested with no extra words, punctuation, or explanation.`;
```

And add `topP?: number` to `LlmRequestOptions`:

```ts
export interface LlmRequestOptions {
  model: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}
```

**Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/providers/types.ts
git commit -m "feat: add FORMATTING_SYSTEM_PROMPT constant and topP to LlmRequestOptions"
```

---

### Task 2: Wire `topP` through OpenAI provider + tests

**Files:**
- Modify: `src/providers/openai.ts`
- Test: `src/__tests__/openai.test.ts` (create if it doesn't exist — check first with `ls src/__tests__/`)

**Step 1: Check if an openai test file exists**

```bash
ls src/__tests__/
```

If `openai.test.ts` does not exist, create it at `src/__tests__/openai.test.ts` using the same mock pattern as `grok.test.ts` (Grok is also OpenAI-SDK-based). Mock `openai`, import `OpenAIProvider`, write the test below.

**Step 2: Write the failing test**

Add to `src/__tests__/openai.test.ts`:

```ts
it("passes topP to the API call", async () => {
  mockCreate.mockResolvedValue(makeResponse());
  await provider.sendRequest({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
    topP: 0.5,
  });
  const call = mockCreate.mock.calls[0][0];
  expect(call.top_p).toBe(0.5);
});

it("defaults topP to 1 when not provided", async () => {
  mockCreate.mockResolvedValue(makeResponse());
  await provider.sendRequest({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
  });
  const call = mockCreate.mock.calls[0][0];
  expect(call.top_p).toBe(1);
});
```

**Step 3: Run to confirm failure**

```bash
pnpm test src/__tests__/openai.test.ts
```
Expected: FAIL — `top_p` not present in call

**Step 4: Update `src/providers/openai.ts`**

Add `top_p: options.topP ?? 1` to the `chat.completions.create` call:

```ts
const response = await this.client.chat.completions.create({
  model: options.model,
  messages: options.messages.map((m) => ({
    role: m.role,
    content: m.content,
  })),
  max_tokens: options.maxTokens ?? 4096,
  temperature: options.temperature ?? 0.7,
  top_p: options.topP ?? 1,
});
```

**Step 5: Run tests to confirm pass**

```bash
pnpm test src/__tests__/openai.test.ts
```
Expected: PASS

**Step 6: Commit**

```bash
git add src/providers/openai.ts src/__tests__/openai.test.ts
git commit -m "feat: wire topP through OpenAI provider"
```

---

### Task 3: Wire `topP` through Grok provider + tests

**Files:**
- Modify: `src/providers/grok.ts`
- Test: `src/__tests__/grok.test.ts`

**Step 1: Write the failing tests**

Add to `src/__tests__/grok.test.ts`:

```ts
it("passes topP to the API call", async () => {
  mockCreate.mockResolvedValue(makeResponse());
  await provider.sendRequest({
    model: "grok-2",
    messages: [{ role: "user", content: "Hello" }],
    topP: 0.5,
  });
  const call = mockCreate.mock.calls[0][0];
  expect(call.top_p).toBe(0.5);
});

it("defaults topP to 1 when not provided", async () => {
  mockCreate.mockResolvedValue(makeResponse());
  await provider.sendRequest({
    model: "grok-2",
    messages: [{ role: "user", content: "Hello" }],
  });
  const call = mockCreate.mock.calls[0][0];
  expect(call.top_p).toBe(1);
});
```

**Step 2: Run to confirm failure**

```bash
pnpm test src/__tests__/grok.test.ts
```
Expected: FAIL

**Step 3: Update `src/providers/grok.ts`**

Add `top_p: options.topP ?? 1` to `chat.completions.create`:

```ts
const response = await this.client.chat.completions.create({
  model: options.model,
  messages: options.messages.map((m) => ({
    role: m.role,
    content: m.content,
  })),
  max_tokens: options.maxTokens ?? 4096,
  temperature: options.temperature ?? 0.7,
  top_p: options.topP ?? 1,
});
```

**Step 4: Run tests**

```bash
pnpm test src/__tests__/grok.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/providers/grok.ts src/__tests__/grok.test.ts
git commit -m "feat: wire topP through Grok provider"
```

---

### Task 4: Wire `topP` through Anthropic provider + tests

**Files:**
- Modify: `src/providers/anthropic.ts`
- Test: `src/__tests__/anthropic.test.ts` (create if it doesn't exist)

**Step 1: Check if an anthropic test file exists**

```bash
ls src/__tests__/
```

If `anthropic.test.ts` does not exist, create it. Mock `@anthropic-ai/sdk` using the same pattern as `gemini.test.ts` (mock the class, import provider after). The Anthropic client method is `this.client.messages.create`.

**Step 2: Write the failing tests**

```ts
it("passes top_p to the API call", async () => {
  mockCreate.mockResolvedValue(makeResponse());
  await provider.sendRequest({
    model: "claude-sonnet-4-6",
    messages: [{ role: "user", content: "Hello" }],
    topP: 0.5,
  });
  const call = mockCreate.mock.calls[0][0];
  expect(call.top_p).toBe(0.5);
});

it("defaults top_p to 1 when not provided", async () => {
  mockCreate.mockResolvedValue(makeResponse());
  await provider.sendRequest({
    model: "claude-sonnet-4-6",
    messages: [{ role: "user", content: "Hello" }],
  });
  const call = mockCreate.mock.calls[0][0];
  expect(call.top_p).toBe(1);
});
```

**Step 3: Run to confirm failure**

```bash
pnpm test src/__tests__/anthropic.test.ts
```
Expected: FAIL

**Step 4: Update `src/providers/anthropic.ts`**

Add `top_p: options.topP ?? 1` to `messages.create`:

```ts
const response = await this.client.messages.create({
  model: options.model,
  max_tokens: options.maxTokens ?? 4096,
  temperature: options.temperature ?? 0.7,
  top_p: options.topP ?? 1,
  ...(systemText.length > 0 ? { system: systemText } : {}),
  messages: conversationMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  })),
});
```

**Step 5: Run tests**

```bash
pnpm test src/__tests__/anthropic.test.ts
```
Expected: PASS

**Step 6: Commit**

```bash
git add src/providers/anthropic.ts src/__tests__/anthropic.test.ts
git commit -m "feat: wire topP through Anthropic provider"
```

---

### Task 5: Wire `topP` through Gemini provider + tests

**Files:**
- Modify: `src/providers/gemini.ts`
- Test: `src/__tests__/gemini.test.ts`

**Step 1: Write the failing tests**

Add to `src/__tests__/gemini.test.ts`:

```ts
it("passes topP to the config", async () => {
  mockGenerateContent.mockResolvedValue(makeResponse());
  await provider.sendRequest({
    model: "gemini-2.5-flash",
    messages: [{ role: "user", content: "Hello" }],
    topP: 0.5,
  });
  const call = mockGenerateContent.mock.calls[0][0];
  expect(call.config.topP).toBe(0.5);
});

it("defaults topP to 1 when not provided", async () => {
  mockGenerateContent.mockResolvedValue(makeResponse());
  await provider.sendRequest({
    model: "gemini-2.5-flash",
    messages: [{ role: "user", content: "Hello" }],
  });
  const call = mockGenerateContent.mock.calls[0][0];
  expect(call.config.topP).toBe(1);
});
```

**Step 2: Run to confirm failure**

```bash
pnpm test src/__tests__/gemini.test.ts
```
Expected: FAIL

**Step 3: Update `src/providers/gemini.ts`**

Add `topP: options.topP ?? 1` to the config block:

```ts
config: {
  maxOutputTokens: options.maxTokens ?? 4096,
  temperature: options.temperature ?? 0.7,
  topP: options.topP ?? 1,
  ...(systemText.length > 0 ? { systemInstruction: systemText } : {}),
},
```

**Step 4: Run tests**

```bash
pnpm test src/__tests__/gemini.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/providers/gemini.ts src/__tests__/gemini.test.ts
git commit -m "feat: wire topP through Gemini provider"
```

---

### Task 6: Update `execute-question.ts` call site

**Files:**
- Modify: `src/worker/handlers/execute-question.ts`

**Step 1: Add the import**

At the top of `execute-question.ts`, update the import from `@/providers/types`:

```ts
import { JSON_ENFORCEMENT_BLOCK, FORMATTING_SYSTEM_PROMPT } from "@/providers/types";
```

**Step 2: Append the formatting system message**

After the existing system message push (around line 61-68), add:

```ts
messages.push({
  role: "system",
  content: FORMATTING_SYSTEM_PROMPT,
});
```

The messages array build block should look like:

```ts
const messages: LlmMessage[] = [
  {
    role: "system",
    content: isRanked
      ? buildRankedSystemPrompt()
      : "You are a research assistant. Answer questions accurately with citations.",
  },
  {
    role: "system",
    content: FORMATTING_SYSTEM_PROMPT,
  },
];
```

**Step 3: Pass temperature and topP in sendRequest**

Update the `provider.sendRequest` call (around line 98-101):

```ts
const response = await provider.sendRequest({
  model: modelTarget.modelName,
  messages,
  temperature: 0,
  topP: 1,
});
```

**Step 4: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```
Expected: no errors

**Step 5: Run full test suite**

```bash
pnpm test
```
Expected: all tests pass

**Step 6: Commit**

```bash
git add src/worker/handlers/execute-question.ts
git commit -m "feat: append formatting system prompt and set temperature/topP in execute-question"
```

---

### Task 7: Update `referee.ts` call site

**Files:**
- Modify: `src/lib/truth-engine/referee.ts`

**Step 1: Add the import**

Add `FORMATTING_SYSTEM_PROMPT` to the import from `@/providers/types`:

```ts
import { FORMATTING_SYSTEM_PROMPT } from "@/providers/types";
```

**Step 2: Append the formatting system message and update parameters**

Find the `provider.sendRequest` call (around line 164) and update the messages array and parameters:

```ts
response = await provider.sendRequest({
  model: REFEREE_MODEL,
  messages: [
    { role: "system", content: "You are an impartial AI referee." },
    { role: "system", content: FORMATTING_SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ],
  maxTokens: REFEREE_MAX_TOKENS,
  temperature: 0,
  topP: 1,
});
```

**Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```
Expected: no errors

**Step 4: Run full test suite**

```bash
pnpm lint && pnpm tsc --noEmit && pnpm test
```
Expected: all pass

**Step 5: Commit**

```bash
git add src/lib/truth-engine/referee.ts
git commit -m "feat: append formatting system prompt and set temperature/topP in referee"
```

---

### Task 8: Final verification and PR

**Step 1: Run full checks**

```bash
pnpm lint && pnpm tsc --noEmit && pnpm test
```
Expected: all pass, no warnings

**Step 2: Push and open PR**

```bash
git push -u origin question-order
gh pr create --title "feat: add formatting system prompt and deterministic parameters to all LLM calls" --base main
```
