# Tech Stack & Functionality Status

Last updated: 2026-03-01

## Tech Stack

### Core Framework

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.1.6 | Web framework (App Router, Server Actions, SSE) |
| React | 19.2.4 | UI rendering |
| TypeScript | 5.9.3 | Language (`strict: true`, path alias `@/*` → `src/*`) |
| Node.js | — | Runtime (web server + standalone worker via `tsx`) |

### UI

| Technology | Version | Purpose |
|---|---|---|
| Tailwind CSS | 4.2.1 | Utility-first CSS framework |
| shadcn/ui | — | Component library (custom implementations, not npm package) |
| Inter | — | Primary font via `next/font/google` |

Components: Badge, Button, Card, Dialog, Input, Label, Progress, Select, Table, Tabs, Textarea. Dark mode via `localStorage` toggle.

### Database & ORM

| Technology | Version | Purpose |
|---|---|---|
| MySQL | — | Primary database |
| Prisma | 6.19.2 | ORM, migrations, type-safe queries |

Singleton Prisma client exported from `src/lib/db.ts`.

### Authentication & Security

| Technology | Version | Purpose |
|---|---|---|
| bcryptjs | 3.0.3 | Password hashing (12 rounds) |
| jose | 6.1.3 | JWT signing/verification (HS256, httpOnly cookies) |

Session cookie (`session`) with configurable max-age (default 24h). Middleware guards all `/app/*` routes.

### LLM SDKs

| Technology | Version | Purpose |
|---|---|---|
| openai | 6.25.0 | OpenAI Chat Completions API |
| @anthropic-ai/sdk | 0.78.0 | Anthropic Messages API |

Adapter pattern: all providers implement `LlmProvider` interface. Registry in `src/providers/registry.ts`.

### NLP & Analysis

| Technology | Version | Purpose |
|---|---|---|
| compromise | 14.15.0 | Named entity extraction (people, places, organizations) |
| Custom word-list | — | Sentiment analysis (-1 to +1 score) |

### Validation

| Technology | Version | Purpose |
|---|---|---|
| Zod | 4.3.6 | Schema validation for all inputs (Server Actions, API responses, env vars) |

### Job Queue

Custom MySQL-backed polling queue — no Redis, no external queue dependency. Worker runs as standalone `tsx` process alongside Next.js via `concurrently`.

### Testing & Dev Tooling

| Technology | Version | Purpose |
|---|---|---|
| Vitest | 4.0.18 | Unit test runner |
| ESLint | 9.39.3 | Linting (with `eslint-config-next`) |
| concurrently | 9.2.1 | Parallel dev processes (web + worker) |
| pnpm | — | Package manager |

---

## Database Schema (13 Models)

| Model | Purpose |
|---|---|
| `User` | Authentication, roles (USER/ADMIN), account disable |
| `Survey` | Survey container with soft delete |
| `SurveyShare` | Per-survey sharing (VIEW/EDIT roles) |
| `Variable` | `{{key}}` template variables with defaults |
| `Question` | Prompt definitions (OPEN_ENDED/RANKED, STATELESS/THREADED) |
| `ModelTarget` | LLM catalog with provider, model name, pricing, enabled flags |
| `SurveyRun` | Run execution instance with status lifecycle |
| `RunModel` | Which models participate in a run |
| `ConversationThread` | Thread history for THREADED mode questions |
| `Job` | Queue jobs (EXECUTE_QUESTION, ANALYZE_RESPONSE, EXPORT_RUN) |
| `LlmResponse` | LLM call output (raw text, parsed JSON, usage, cost) |
| `AnalysisResult` | NLP output (sentiment, entities, brands, institutions, flags) |
| `AuditEvent` | Audit trail for sensitive operations |

Provider enums: `OPENAI`, `ANTHROPIC`, `GEMINI`, `PERPLEXITY`, `COPILOT`

---

## Functionality Status

### Fully Implemented

**Authentication & Authorization**
- Login/logout with bcrypt password hashing and JWT session cookies
- Role-based access: USER and ADMIN roles
- Middleware-protected routes for all `/app/*` paths
- Survey-level sharing with VIEW/EDIT permissions
- ADMIN bypasses all survey access checks
- Disabled account blocking at login
- Audit logging for login success/failure and sensitive operations

**Survey Management**
- Full CRUD for surveys with soft delete
- Question builder: OPEN_ENDED and RANKED question types
- Question modes: STATELESS (independent) and THREADED (conversation history)
- Thread key support for grouping threaded questions
- Variable management with `{{key}}` template substitution
- Survey sharing by email with VIEW/EDIT roles

**Run Configuration & Execution**
- Model selection with checkbox cards (provider, pricing display)
- Pre-selection of cost-effective default models
- Variable override inputs per run
- Real-time cost estimation with per-model breakdown
- Token and cost limit enforcement (blocks run start if exceeded)
- Deterministic job allocation with idempotency keys
- MySQL-backed job queue with optimistic locking
- Configurable worker concurrency per job type

**LLM Providers**
- OpenAI adapter: Chat Completions API (temperature 0.7, max_tokens 4096)
- Anthropic adapter: Messages API (same defaults)
- JSON enforcement block appended to all prompts
- Multi-step JSON repair pipeline (markdown fences, smart quotes, trailing commas)

**Ranked Questions**
- Configurable scale presets (0-5, 0-10, 0-100)
- Dedicated system prompt and enforcement block for numeric scoring
- Score clamping and validation
- Optional reasoning field

**Threaded Conversations**
- ConversationThread upsert with full message history
- Thread key grouping across questions within a run

**Run Progress & Results**
- SSE endpoint for live progress (polls DB every 2s)
- Progress bar with stat grid (total/completed/failed/running)
- Summary cards on completion (response count, total cost, avg cost)
- Results table grouped by question with per-model rows
- Row expansion: full answer, citations, analysis badges, entities
- Score bar visualization for RANKED questions (green/yellow/red)
- Debug dialog: raw request messages, raw response, token counts
- Run cancellation (bulk-cancels PENDING jobs)

**NLP Analysis**
- Word-list sentiment scoring (-1 to +1)
- Named entity extraction via compromise (people, places, organizations)
- Brand mention detection (PascalCase, mixed-caps patterns)
- Institution mention detection (University, Foundation, etc.)
- Automated flags: invalid_json, empty_answer, short_answer, extreme_sentiment

**Settings**
- Profile update (name)
- Password change
- Account self-disable
- Dark mode toggle with FOUC prevention

**Infrastructure**
- CI via GitHub Actions
- Automated Claude Code PR reviewer workflow
- Prisma migrations for schema changes
- Seed script for admin user and model targets

### Partially Implemented / Stubs

| Feature | Status | Details |
|---|---|---|
| Gemini provider | Stub | Enum + registry entry exist; throws "Provider not implemented" |
| Perplexity provider | Stub | Enum + registry entry exist; throws "Provider not implemented" |
| Copilot provider | Stub | Enum + registry entry exist; throws "Provider not implemented" |
| CSV export | Placeholder | Generates CSV in memory and logs to console; no file persistence, no download endpoint |
| LLM analysis repass | Unimplemented | `ENABLE_LLM_ANALYSIS_REPASS` env accessor exists but no code reads it |
| Job retry logic | Unimplemented | `RETRYING` status enum exists but worker never sets it |
| Admin UI | Not built | ADMIN role works for access control but no admin pages for user/model management |

### Test Coverage

5 test files covering pure logic modules:

| Test File | Module | Tests |
|---|---|---|
| `allocation.test.ts` | `src/lib/allocation.ts` | 7 tests (ordering, idempotency, threads, payloads) |
| `json-repair.test.ts` | `src/lib/json-repair.ts` | 7 tests (valid JSON, fences, trailing commas, smart quotes) |
| `variable-substitution.test.ts` | `src/lib/variable-substitution.ts` | 7 tests (basic sub, unresolved vars, prototype safety) |
| `ranked-prompt.test.ts` | `src/lib/ranked-prompt.ts` | 8 tests (system prompt, enforcement block, score clamping) |
| `schemas-ranked.test.ts` | `src/lib/schemas.ts` | 13 tests (ranked config/response validation, schema refinements) |

**Not yet tested:** sentiment analysis, entity extraction, estimation, provider adapters, server actions, API routes, worker handlers.
