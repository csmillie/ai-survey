# SDLC Compliance Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 7 compliance violations found during code review against CLAUDE.md standards.

**Architecture:** Targeted fixes across env.ts, worker, provider registry, server actions, UI components, README, and package.json. No structural changes — just bringing existing code into alignment with documented standards.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, React 19, Prisma + MySQL

---

### Task 1: Route all process.env reads through env.ts

**Files:**
- Modify: `src/lib/env.ts` (add `isProduction()`)
- Modify: `src/worker/index.ts` (use env.ts accessor)
- Modify: `src/providers/registry.ts` (use env.ts accessors)
- Modify: `src/app/login/actions.ts` (use `isProduction()`)

**Step 1: Add `isProduction()` to env.ts**

At the end of `src/lib/env.ts`, add:

```typescript
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
```

**Step 2: Fix src/worker/index.ts**

The worker runs as a standalone process via `tsx`, so it can't use the `@/` path alias.
Change line 12 from:
```typescript
const EXECUTE_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY_OPENAI ?? "5", 10);
```
to:
```typescript
const EXECUTE_CONCURRENCY = parseInt(process.env["WORKER_CONCURRENCY_OPENAI"] ?? "5", 10);
```

Wait — the worker runs via `tsx` which doesn't resolve `@/` aliases. Check if the worker already uses relative imports. Looking at the imports: it imports from `"./handlers/..."` — relative paths. It does NOT import from `@/lib/env`. Since the worker runs outside Next.js, it can't use `@/` imports.

**Revised approach for worker:** Add a comment documenting this is an intentional exception:

Change lines 10-14 in `src/worker/index.ts` from:
```typescript
const POLL_INTERVAL_MS = 2000;
const EXECUTE_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY_OPENAI ?? "5", 10);
const ANALYZE_CONCURRENCY = 10;
const EXPORT_CONCURRENCY = 2;
```
to:
```typescript
// NOTE: Worker runs as standalone tsx process, can't use @/lib/env path alias.
// Direct process.env reads are an intentional exception to the env.ts convention.
const POLL_INTERVAL_MS = 2000;
const EXECUTE_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY_OPENAI ?? "5", 10);
const ANALYZE_CONCURRENCY = 10;
const EXPORT_CONCURRENCY = 2;
```

**Step 3: Fix src/providers/registry.ts**

Replace the file content. Remove the local `requireEnv` function, import from `@/lib/env`:

Replace lines 1-23 with:
```typescript
import type { LlmProvider } from "./types";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import {
  GeminiProvider,
  PerplexityProvider,
  CopilotProvider,
} from "./stubs";
import { getOpenaiApiKey, getAnthropicApiKey } from "@/lib/env";

export type ProviderName =
  | "OPENAI"
  | "ANTHROPIC"
  | "GEMINI"
  | "PERPLEXITY"
  | "COPILOT";
```

And update `getProvider` lines 25-44. Replace:
```typescript
export function getProvider(provider: ProviderName | string): LlmProvider {
  switch (provider) {
    case "OPENAI": {
      const apiKey = requireEnv("OPENAI_API_KEY");
      return new OpenAIProvider(apiKey);
    }
    case "ANTHROPIC": {
      const apiKey = requireEnv("ANTHROPIC_API_KEY");
      return new AnthropicProvider(apiKey);
    }
```
with:
```typescript
export function getProvider(provider: ProviderName | string): LlmProvider {
  switch (provider) {
    case "OPENAI":
      return new OpenAIProvider(getOpenaiApiKey());
    case "ANTHROPIC":
      return new AnthropicProvider(getAnthropicApiKey());
```

**Step 4: Fix src/app/login/actions.ts**

Add import for `isProduction` and replace the `process.env.NODE_ENV` usage.

Add to imports (after the existing `getSessionMaxAgeSeconds` import):
```typescript
import { getSessionMaxAgeSeconds, isProduction } from "@/lib/env";
```
(Replace the existing single import of `getSessionMaxAgeSeconds`.)

Replace line 67:
```typescript
    secure: process.env.NODE_ENV === "production",
```
with:
```typescript
    secure: isProduction(),
```

**Step 5: Run tests**

Run: `pnpm test`
Expected: All 18 tests pass.

**Step 6: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors.

**Step 7: Commit**

```bash
git add src/lib/env.ts src/worker/index.ts src/providers/registry.ts src/app/login/actions.ts
git commit -m "fix: route process.env reads through env.ts accessors"
```

---

### Task 2: Add return types and { success, error } pattern to survey detail actions

This is the largest task. The `[surveyId]/actions.ts` file has 12 exported functions that throw on validation failure. They need to return `{ success: false, error: string }` instead, and the UI needs to handle this.

**Files:**
- Modify: `src/app/app/surveys/[surveyId]/actions.ts`
- Modify: `src/app/app/surveys/[surveyId]/survey-builder.tsx`

**Step 1: Define action result type and convert all actions in [surveyId]/actions.ts**

At the top of the file (after imports, before the first function), add:

```typescript
// ---------------------------------------------------------------------------
// Action result type
// ---------------------------------------------------------------------------

interface ActionResult {
  success: boolean;
  error?: string;
}
```

Then convert each function. The pattern is the same for all:
- Add return type `: Promise<ActionResult>`
- Change `throw new Error(...)` to `return { success: false, error: "..." }`
- Add `return { success: true }` at the end

Here are all the conversions:

**updateSurveyAction** (line 32): change signature to:
```typescript
export async function updateSurveyAction(surveyId: string, formData: FormData): Promise<ActionResult> {
```
Replace lines 43-46:
```typescript
  if (!parsed.success) {
    throw new Error(
      `Invalid survey data: ${parsed.error.issues.map((i) => i.message).join(", ")}`
    );
  }
```
with:
```typescript
  if (!parsed.success) {
    return { success: false, error: `Invalid survey data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }
```
Add before the closing `}`:
```typescript
  return { success: true };
```

**addQuestionAction** (line 69): change signature to:
```typescript
export async function addQuestionAction(surveyId: string, formData: FormData): Promise<ActionResult> {
```
Replace lines 90-93 (the throw) with:
```typescript
  if (!parsed.success) {
    return { success: false, error: `Invalid question data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }
```
Add `return { success: true };` at end.

**updateQuestionAction** (line 125): change signature to:
```typescript
export async function updateQuestionAction(
  surveyId: string,
  questionId: string,
  formData: FormData
): Promise<ActionResult> {
```
Replace lines 146-149 (the throw) with:
```typescript
  if (!parsed.success) {
    return { success: false, error: `Invalid question data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }
```
Add `return { success: true };` at end.

**deleteQuestionAction** (line 168): change signature to:
```typescript
export async function deleteQuestionAction(
  surveyId: string,
  questionId: string
): Promise<ActionResult> {
```
Add `return { success: true };` at end.

**addVariableAction** (line 194): change signature to:
```typescript
export async function addVariableAction(surveyId: string, formData: FormData): Promise<ActionResult> {
```
Replace lines 205-208 (the throw) with:
```typescript
  if (!parsed.success) {
    return { success: false, error: `Invalid variable data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }
```
Add `return { success: true };` at end.

**updateVariableAction** (line 231): change signature to:
```typescript
export async function updateVariableAction(
  surveyId: string,
  variableId: string,
  formData: FormData
): Promise<ActionResult> {
```
Replace lines 249-252 (the throw) with:
```typescript
  if (!parsed.success) {
    return { success: false, error: `Invalid variable data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }
```
Add `return { success: true };` at end.

**deleteVariableAction** (line 271): change signature to:
```typescript
export async function deleteVariableAction(
  surveyId: string,
  variableId: string
): Promise<ActionResult> {
```
Add `return { success: true };` at end.

**addShareAction** (line 297): change signature to:
```typescript
export async function addShareAction(surveyId: string, formData: FormData): Promise<ActionResult> {
```
Replace lines 307-310 (the first throw) with:
```typescript
  if (!parsed.success) {
    return { success: false, error: `Invalid share data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }
```
Replace lines 318-319 (the second throw) with:
```typescript
  if (!targetUser) {
    return { success: false, error: "User not found with that email address" };
  }
```
Add `return { success: true };` at end.

**removeShareAction** (line 341): change signature to:
```typescript
export async function removeShareAction(surveyId: string, shareId: string): Promise<ActionResult> {
```
Add `return { success: true };` at end.

**Step 2: Update survey-builder.tsx to handle action results**

The client component calls these actions via `await action(formData)`. Update each handler to check the return value. The simplest approach: if the action returns an error, show an alert. This avoids a big refactor while being correct.

In `SurveyHeader` component, update `handleSave` (line 234):
```typescript
  async function handleSave(formData: FormData) {
    const result = await boundUpdateSurvey(formData);
    if (result && !result.success) {
      alert(result.error);
      return;
    }
    setEditing(false);
  }
```

In `QuestionsTab` component, update `handleAddQuestion` (line 317):
```typescript
  async function handleAddQuestion(formData: FormData) {
    const result = await boundAddQuestion(formData);
    if (result && !result.success) {
      alert(result.error);
      return;
    }
    addFormRef.current?.reset();
    setAddDialogOpen(false);
  }
```

In `QuestionEditRow` component, update `handleSubmit` (line 465):
```typescript
  async function handleSubmit(formData: FormData) {
    const result = await boundUpdate(formData);
    if (result && !result.success) {
      alert(result.error);
      return;
    }
    onDone();
  }
```

In `VariablesTab` component, update `handleAddVariable` (line 566):
```typescript
  async function handleAddVariable(formData: FormData) {
    const result = await boundAddVariable(formData);
    if (result && !result.success) {
      alert(result.error);
      return;
    }
    addFormRef.current?.reset();
  }
```

In `VariableEditRow` component, update `handleSubmit` (line 706):
```typescript
  async function handleSubmit(formData: FormData) {
    const result = await boundUpdate(formData);
    if (result && !result.success) {
      alert(result.error);
      return;
    }
    onDone();
  }
```

In `SharingTab` component, update `handleAddShare` (line 799):
```typescript
  async function handleAddShare(formData: FormData) {
    const result = await boundAddShare(formData);
    if (result && !result.success) {
      alert(result.error);
      return;
    }
    addFormRef.current?.reset();
  }
```

**Step 3: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors.

**Step 4: Run tests**

Run: `pnpm test`
Expected: All 18 tests pass.

**Step 5: Commit**

```bash
git add src/app/app/surveys/[surveyId]/actions.ts src/app/app/surveys/[surveyId]/survey-builder.tsx
git commit -m "fix: add return types and { success, error } pattern to survey detail actions"
```

---

### Task 3: Add return types to remaining action files

**Files:**
- Modify: `src/app/app/actions.ts` (logoutAction)
- Modify: `src/app/app/surveys/actions.ts` (createSurveyAction, deleteSurveyAction)

**Step 1: Fix logoutAction in src/app/app/actions.ts**

Replace the file content with:
```typescript
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutAction(): Promise<never> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/login");
}
```

**Step 2: Fix surveys/actions.ts**

Add return types and convert throws to returns for these two actions. Since they redirect on success, the return type is `Promise<{ error: string }>` (only the error path returns).

Replace `createSurveyAction` (lines 14-46):
```typescript
export async function createSurveyAction(formData: FormData): Promise<{ error: string }> {
  const session = await requireSession();

  const raw = {
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  };

  const parsed = createSurveySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: `Invalid survey data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }

  const survey = await prisma.survey.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      ownerId: session.userId,
    },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: SURVEY_CREATED,
    targetType: "Survey",
    targetId: survey.id,
    meta: { title: survey.title },
  });

  redirect(`/app/surveys/${survey.id}`);
}
```

Replace `deleteSurveyAction` (lines 48-71):
```typescript
export async function deleteSurveyAction(formData: FormData): Promise<{ error: string }> {
  const session = await requireSession();

  const surveyId = formData.get("surveyId");
  if (typeof surveyId !== "string" || !surveyId) {
    return { error: "Missing surveyId" };
  }

  await requireSurveyAccess(session.userId, surveyId, "EDIT");

  await prisma.survey.update({
    where: { id: surveyId },
    data: { deletedAt: new Date() },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: SURVEY_DELETED,
    targetType: "Survey",
    targetId: surveyId,
  });

  redirect("/app/surveys");
}
```

**Step 3: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/app/app/actions.ts src/app/app/surveys/actions.ts
git commit -m "fix: add explicit return types to all exported server action functions"
```

---

### Task 4: Fix stale comment, README, CLAUDE.md worker note, remove unused dep

**Files:**
- Modify: `src/app/app/surveys/[surveyId]/run/actions.ts` (line 260)
- Modify: `README.md` (line 75)
- Modify: `CLAUDE.md` (worker section)
- Modify: `package.json` (remove @vitejs/plugin-react)

**Step 1: Fix stale pg-boss comment**

In `src/app/app/surveys/[surveyId]/run/actions.ts`, change line 260 from:
```typescript
  // 9. Enqueue jobs to pg-boss
```
to:
```typescript
  // 9. Signal queue (no-op — jobs already PENDING in DB, worker polls)
```

**Step 2: Fix README Nginx config**

In `README.md`, add a comment to the Nginx config section. Change lines 73-80:
```nginx
   location /api/runs/ {
     proxy_pass http://localhost:3000;
     proxy_http_version 1.1;
     proxy_set_header Connection '';
     proxy_buffering off;
     proxy_cache off;
   }
```
to:
```nginx
   location /api/runs/ {
     # Production: next start defaults to port 3000 (dev uses 5001)
     proxy_pass http://localhost:3000;
     proxy_http_version 1.1;
     proxy_set_header Connection '';
     proxy_buffering off;
     proxy_cache off;
   }
```

**Step 3: Document worker exception in CLAUDE.md**

In the "Error Handling" section of `CLAUDE.md`, after the line about `src/lib/env.ts`, add a note. Find:
```markdown
- Use `src/lib/env.ts` typed accessors for all environment variables. Never read `process.env` directly.
```
Replace with:
```markdown
- Use `src/lib/env.ts` typed accessors for all environment variables. Never read `process.env` directly. Exception: `src/worker/index.ts` runs as a standalone `tsx` process outside Next.js and cannot use `@/` path aliases.
```

**Step 4: Remove @vitejs/plugin-react**

In `package.json`, remove the line:
```json
    "@vitejs/plugin-react": "^5.1.4",
```

Then run: `pnpm install`

**Step 5: Commit**

```bash
git add src/app/app/surveys/[surveyId]/run/actions.ts README.md CLAUDE.md package.json pnpm-lock.yaml
git commit -m "fix: stale pg-boss comment, README port note, CLAUDE.md worker exception, remove unused dep"
```

---

### Task 5: Final verification

**Step 1: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors.

**Step 2: Run tests**

Run: `pnpm test`
Expected: All 18 tests pass.

**Step 3: Grep for remaining process.env outside env.ts and worker**

Run: `grep -rn "process\.env" src/ --include="*.ts" --include="*.tsx" | grep -v "env.ts" | grep -v "worker/index.ts" | grep -v "db.ts"`
Expected: Zero matches (or only the `isProduction()` usage in login/actions.ts which now calls `isProduction()` instead).

**Step 4: Verify no stale pg-boss references in source**

Run: `grep -rn "pg-boss\|pg_boss" src/`
Expected: Zero matches.

**Step 5: Verify all exported functions have return types**

Run: `grep -rn "export async function" src/app/ --include="*.ts" | grep -v "Promise"`
Expected: Zero matches (all exported async functions should have explicit Promise return types).
