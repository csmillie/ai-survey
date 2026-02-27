# Architecture

## Core Entities

Survey, Question, Variable, SurveyRun, Job, LlmResponse, AnalysisResult.

## Flow

1. **Create survey** — define questions with prompt templates and variables
2. **Configure run** — select models, set variable overrides
3. **Estimate** — calculate expected tokens and cost before committing
4. **Allocate** — deterministically create Job rows (models × questions) with idempotency keys
5. **Execute** — MySQL-backed worker polls Job table, claims PENDING jobs, calls LLM providers
6. **Store** — raw + parsed responses saved to LlmResponse, analysis to AnalysisResult
7. **Display** — UI shows real-time progress via SSE (`/api/runs/[runId]/events`)

## Key Architectural Decisions

- **MySQL-backed job queue** instead of external queue (pg-boss, Redis). Jobs are rows in the `Job` table. Worker uses optimistic locking for concurrency-safe claiming. No additional infrastructure needed.
- **Server Actions** for all mutations. No REST API for CRUD operations.
- **SSE** for live run progress (not WebSocket). Simpler, works through Nginx with `proxy_buffering off`.
- **JSON enforcement** on all LLM responses via appended instruction block + server-side repair/validation.
