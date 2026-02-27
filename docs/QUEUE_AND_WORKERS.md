# Queue & Workers

## Overview

The job queue is backed by MySQL. Jobs are rows in the `Job` table (defined in `prisma/schema.prisma`). There is no external queue dependency — the worker polls the database directly.

## Job Types

| Type | Purpose |
|------|---------|
| `EXECUTE_QUESTION` | Call an LLM provider with a rendered prompt, store the response |
| `ANALYZE_RESPONSE` | Run sentiment/entity analysis on an LLM response |
| `EXPORT_RUN` | Export run results |

## How It Works

1. **Job creation:** When a run starts, `src/lib/allocation.ts` creates `Job` rows with `PENDING` status directly in the database. Each job has a unique `idempotencyKey` to prevent duplicates.

2. **Worker polling:** `src/worker/index.ts` polls the `Job` table every 2 seconds. For each job type, it looks for `PENDING` jobs and attempts to claim them.

3. **Optimistic locking:** The worker claims a job by running `updateMany` with a `WHERE status = 'PENDING'` clause. If another worker already claimed it (count = 0), the claim is skipped. This prevents double-processing without requiring database-level locks.

4. **Concurrency limits:** Each job type has a configurable concurrency limit:
   - `EXECUTE_QUESTION`: `WORKER_CONCURRENCY_OPENAI` env var (default 5)
   - `ANALYZE_RESPONSE`: 10
   - `EXPORT_RUN`: 2

5. **Job lifecycle:** `PENDING` → `RUNNING` → `SUCCEEDED` or `FAILED`

6. **Graceful shutdown:** On `SIGTERM`/`SIGINT`, the worker stops polling and waits up to 30 seconds for active jobs to finish before disconnecting.

## Running the Worker

```bash
pnpm worker          # Standalone
pnpm dev             # Runs alongside web server via concurrently
```

## Key Files

| File | Purpose |
|------|---------|
| `src/worker/index.ts` | Poll loop, job claiming, shutdown |
| `src/worker/handlers/execute-question.ts` | LLM execution handler |
| `src/worker/handlers/analyze-response.ts` | NLP analysis handler |
| `src/worker/handlers/export-run.ts` | Export handler |
| `src/lib/queue.ts` | Enqueue helpers (create Job rows) |
| `src/lib/allocation.ts` | Deterministic job creation |
