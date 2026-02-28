# SDLC Hygiene Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish Claude Code-enforced SDLC hygiene and fix all doc drift across the project.

**Architecture:** CLAUDE.md-centric approach. The root CLAUDE.md becomes the single source of truth for all development standards. All existing docs in docs/ are corrected to match actual implementation (MySQL, custom polling worker, port 5001). A CONTRIBUTING.md provides human-readable workflow guidance.

**Tech Stack:** Next.js 16, TypeScript strict, Prisma + MySQL, custom MySQL-backed polling job queue, Vitest

---

### Task 1: Create Root CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

**Step 1: Write the CLAUDE.md file**

Create `CLAUDE.md` at the project root with the following exact content:

```markdown
# CLAUDE.md — LLM Survey Platform

## Project Overview

LLM Survey Platform v1: a SurveyMonkey-style app for running structured prompt surveys against multiple LLM chat APIs (OpenAI, Anthropic). Users create surveys with questions and variables, configure runs against selected models, and the system executes prompts, collects JSON-structured responses, performs NLP analysis, and displays real-time progress via SSE.

**Tech stack:** Next.js 16 (App Router), TypeScript (strict), Tailwind CSS + shadcn/ui, Prisma + MySQL, custom MySQL-backed polling job queue, Vitest.

## Development Workflow

### Branch Strategy

- `main` is the stable branch. Never commit directly to main.
- Feature branches: `feat/<short-description>` (e.g., `feat/add-gemini-provider`)
- Bug fixes: `fix/<short-description>` (e.g., `fix/json-repair-trailing-comma`)
- Chores/refactors: `chore/<short-description>` or `refactor/<short-description>`

### Commit Conventions

Use conventional commits. Format: `<type>: <description>`

Types:
- `feat:` — new feature or capability
- `fix:` — bug fix
- `refactor:` — code restructuring, no behavior change
- `docs:` — documentation only
- `test:` — adding or updating tests
- `chore:` — build, deps, tooling changes

Examples:
- `feat: add Gemini provider adapter`
- `fix: handle trailing commas in LLM JSON output`
- `docs: update QUEUE_AND_WORKERS for MySQL polling`

### Pre-Commit Checks

Before every commit, run and confirm all pass:

```bash
pnpm lint
pnpm tsc --noEmit
pnpm test
```

Do NOT commit if any of these fail. Fix issues first.

### PR Workflow

1. Create feature branch from `main`
2. Make changes with atomic commits
3. Push branch and open PR
4. PR must include: description of what changed and why, test plan
5. All checks must pass before merge
6. Squash-merge to main

## Code Standards

### TypeScript

- Strict mode is enabled (`strict: true` in tsconfig.json). Do not weaken it.
- Never use `any`. Use `unknown` with type narrowing, or define proper types.
- Explicit return types on all exported functions.
- Use `satisfies` for type checking object literals where appropriate.
- Path alias: `@/*` maps to `src/*`. Always use `@/` imports, never relative paths that go above the current directory.

### Next.js Patterns

- Use App Router exclusively. No pages/ directory.
- Server Actions for mutations (create, update, delete). Located in `actions.ts` files colocated with pages.
- All Server Action inputs must be validated with Zod schemas from `src/lib/schemas.ts`.
- Server Components by default. Only use `"use client"` when interactivity is required.
- SSE via `src/app/api/runs/[runId]/events/route.ts` for live progress.

### Prisma & Database

- Database: MySQL. Schema at `prisma/schema.prisma`.
- Use Prisma migrations for schema changes: `pnpm prisma:migrate`
- Use `pnpm prisma:push` only for rapid local prototyping, never for production.
- Never write raw SQL unless Prisma can't express the query.
- Singleton Prisma client in `src/lib/db.ts` — always import from there.
- All new models need appropriate `@@index` annotations on foreign keys and frequently queried fields.

### Error Handling

- Validate all external input (user input, API responses, env vars) with Zod at system boundaries.
- Use `src/lib/env.ts` typed accessors for all environment variables. Never read `process.env` directly.
- Server Actions return `{ success: boolean; error?: string }` patterns.
- LLM responses go through `src/lib/json-repair.ts` for resilient parsing.

### Security

- Never commit secrets or API keys. All secrets go in `.env` (gitignored).
- Passwords hashed with bcrypt (12 rounds) via `src/lib/auth.ts`.
- Sessions are httpOnly JWT cookies via `jose`.
- Audit logging for sensitive operations via `src/lib/audit.ts`.
- All protected routes guarded by `src/middleware.ts` (checks session cookie).

## Architecture

### File Organization

```
src/
  app/                     # Next.js App Router (pages + server actions)
    login/                 # Auth pages
    app/                   # Protected routes (guarded by middleware)
      surveys/             # Survey CRUD + builder
        [surveyId]/        # Survey detail + run config
          run/             # Run configuration + estimation
      runs/
        [runId]/           # Run progress + results
    api/                   # API routes (SSE)
  components/ui/           # shadcn/ui components
  lib/                     # Core business logic + utilities
    analysis/              # NLP: sentiment + entity extraction
  providers/               # LLM provider adapters (OpenAI, Anthropic)
  worker/                  # Background job worker (MySQL polling)
    handlers/              # Job type handlers
  __tests__/               # Unit tests (colocated test directory)
prisma/                    # Schema + migrations + seed
docs/                      # Architecture + spec documentation
```

### Key Patterns

- **LLM Providers:** Adapter pattern in `src/providers/`. All providers implement `LlmProvider` interface from `src/providers/types.ts`. Registry in `src/providers/registry.ts`.
- **Job Queue:** MySQL-backed polling. Jobs created as rows in the `Job` table with `PENDING` status. Worker (`src/worker/index.ts`) polls and claims jobs using optimistic locking. No external queue dependency.
- **Allocation:** Deterministic job creation in `src/lib/allocation.ts`. Double-loop: models × questions. Idempotency keys prevent duplicates.
- **Variable Substitution:** `{{key}}` templates rendered by `src/lib/variable-substitution.ts`.

## Testing

### What to Test

- Pure logic: allocation engine, variable substitution, JSON repair, estimation
- Schema validation edge cases
- Provider adapters (mock LLM responses)

### Where Tests Go

- `src/__tests__/` directory, mirroring the module being tested
- Test file naming: `<module>.test.ts`

### How to Run

```bash
pnpm test          # Single run
pnpm test:watch    # Watch mode
```

### Test Design

- Each test should have a clear arrange/act/assert structure
- Test behavior, not implementation
- Use descriptive test names: `it("returns empty array when no variables are defined")`

## Documentation

- Architecture docs live in `docs/`. Update them when architectural decisions change.
- Keep docs synced with implementation. If you change how the queue works, update `docs/QUEUE_AND_WORKERS.md`.
- This file (CLAUDE.md) is the source of truth for conventions. The `docs/` files describe what the system does; CLAUDE.md describes how we work.

## Running Locally

```bash
pnpm install                # Install deps
cp .env.example .env        # Configure environment
pnpm prisma:generate        # Generate Prisma client
pnpm prisma:migrate         # Run migrations
pnpm seed                   # Seed admin user + model targets
pnpm dev                    # Start web (port 5001) + worker concurrently
```

Web: http://localhost:5001 | Worker: runs alongside via `concurrently`
```

**Step 2: Verify the file was created**

Run: `cat CLAUDE.md | head -5`
Expected: First 5 lines of the file starting with `# CLAUDE.md`

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add comprehensive root CLAUDE.md with SDLC conventions"
```

---

### Task 2: Create Root CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

**Step 1: Write the CONTRIBUTING.md file**

Create `CONTRIBUTING.md` at the project root with the following exact content:

```markdown
# Contributing to LLM Survey Platform

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- MySQL 8+

### Setup

```bash
git clone <repo-url>
cd ai-survey
pnpm install
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, API keys
pnpm prisma:generate
pnpm prisma:migrate
pnpm seed
pnpm dev
```

The web app runs on http://localhost:5001. The worker starts automatically alongside via `concurrently`.

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feat/my-feature   # New feature
git checkout -b fix/my-bugfix     # Bug fix
```

Branch naming: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`

### 2. Make Changes

- Write tests first when adding logic (see Testing below)
- Validate all inputs with Zod schemas in `src/lib/schemas.ts`
- Use TypeScript strict mode — no `any` types
- Import with `@/` path alias (e.g., `import { prisma } from "@/lib/db"`)

### 3. Verify Before Committing

```bash
pnpm lint          # ESLint
pnpm tsc --noEmit  # Type checking
pnpm test          # Unit tests
```

All three must pass before committing.

### 4. Commit with Conventional Commits

```
feat: add Gemini provider adapter
fix: handle trailing commas in LLM JSON output
refactor: extract job claiming into separate module
docs: update deployment guide for MySQL
test: add allocation engine edge case tests
chore: bump Next.js to 16.2
```

### 5. Open a Pull Request

- Push your branch: `git push -u origin feat/my-feature`
- Open PR against `main`
- Include: what changed, why, and how to test
- All checks must pass
- Squash-merge when approved

## Testing

Run tests:

```bash
pnpm test          # Single run
pnpm test:watch    # Watch mode
```

Tests live in `src/__tests__/`. When adding new pure logic (allocation, parsing, validation), add corresponding tests.

## Project Structure

```
src/
  app/              # Next.js App Router pages + server actions
  components/ui/    # shadcn/ui components
  lib/              # Core logic (auth, db, queue, schemas, etc.)
    analysis/       # NLP analysis (sentiment, entities)
  providers/        # LLM provider adapters
  worker/           # Background job worker
    handlers/       # Job type handlers
  __tests__/        # Unit tests
prisma/             # Database schema + migrations + seed
docs/               # Architecture documentation
```

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Development standards (source of truth) |
| `src/lib/schemas.ts` | All Zod validation schemas |
| `src/lib/auth.ts` | JWT + bcrypt authentication |
| `src/lib/db.ts` | Prisma client singleton |
| `src/lib/env.ts` | Typed environment variable accessors |
| `src/providers/types.ts` | LLM provider interface |
| `src/worker/index.ts` | Job queue worker (MySQL polling) |
| `prisma/schema.prisma` | Database schema |

## Architecture Docs

Detailed specs live in `docs/`:
- `ARCHITECTURE.md` — System flow
- `DATA_MODEL.md` — Prisma entities
- `QUEUE_AND_WORKERS.md` — Job queue design
- `LLM_PROVIDER_ADAPTERS.md` — Provider abstraction
- `ALLOCATION_ENGINE.md` — Deterministic job creation
- `PROMPT_CONTRACT.md` — JSON enforcement for LLM responses
- `DEPLOYMENT_VPS.md` — VPS deployment guide
- `SECURITY.md` — Auth + security features
```

**Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING.md with developer workflow guide"
```

---

### Task 3: Fix README.md

**Files:**
- Modify: `README.md` (entire file)

**Step 1: Rewrite README.md**

Replace the entire content of `README.md` with:

```markdown
# LLM Survey Platform (v1)

A SurveyMonkey-style platform for running structured prompt surveys against multiple LLM chat APIs.

**Tech:** Next.js 16 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, Prisma + MySQL, custom MySQL-backed job queue, SSE for live progress.

## How to Run Locally

### Prerequisites

- Node.js 18+
- pnpm
- MySQL 8+

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file and configure
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, API keys, etc.

# 3. Generate Prisma client
pnpm prisma:generate

# 4. Run database migrations
pnpm prisma:migrate

# 5. Seed the database (creates admin user + model targets)
pnpm seed

# 6. Start the web app + worker together
pnpm dev
```

The web app runs on http://localhost:5001. The worker runs concurrently in the same terminal.

To run the worker separately: `pnpm worker` in a second terminal with `pnpm dev:web` for the web server alone.

### Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start web server (port 5001) + worker concurrently |
| `pnpm dev:web` | Start Next.js dev server only (port 5001) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm worker` | Start MySQL-backed job queue worker |
| `pnpm prisma:generate` | Generate Prisma client |
| `pnpm prisma:migrate` | Run database migrations |
| `pnpm prisma:push` | Push schema changes (local dev only) |
| `pnpm seed` | Seed admin user + model targets |
| `pnpm test` | Run tests (Vitest) |
| `pnpm test:watch` | Run tests in watch mode |

## How to Deploy to VPS

Refer to [docs/DEPLOYMENT_VPS.md](docs/DEPLOYMENT_VPS.md) for full details.

### Quick Checklist

1. Provision a VPS with Node.js 18+, MySQL 8+, and Nginx
2. Clone the repo and install dependencies with `pnpm install --frozen-lockfile`
3. Copy `.env.example` to `.env` and configure all secrets (DATABASE_URL, JWT_SECRET, API keys)
4. Run `pnpm prisma:migrate` and `pnpm seed`
5. Build with `pnpm build`
6. Run the web app with `pnpm start` (or use systemd/PM2)
7. Run the worker with `pnpm worker` (separate systemd service/PM2 process)
8. Configure Nginx as reverse proxy with SSE support:
   ```nginx
   location /api/runs/ {
     proxy_pass http://localhost:3000;
     proxy_http_version 1.1;
     proxy_set_header Connection '';
     proxy_buffering off;
     proxy_cache off;
   }
   ```
9. Set up TLS with Let's Encrypt / certbot
10. (Optional) Use Docker Compose for containerized deployment

## Project Structure

```
src/
  app/                     # Next.js App Router pages
    login/                 # Login page
    app/                   # Protected app routes
      surveys/             # Survey list, create, builder
        [surveyId]/        # Survey builder + run config
          run/             # Run configuration + estimation
      runs/
        [runId]/           # Run progress + results
    api/
      runs/[runId]/events/ # SSE endpoint
  components/ui/           # shadcn/ui components
  lib/                     # Core utilities
    analysis/              # Sentiment + entity extraction
  providers/               # LLM provider adapters
  worker/                  # MySQL-backed job queue worker
    handlers/              # Job handlers
  __tests__/               # Unit tests
prisma/
  schema.prisma            # Database schema
  seed.ts                  # Seed script
docs/                      # Architecture + spec documentation
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, commit conventions, and coding standards.
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: fix README — correct port, tech stack, scripts, add contributing link"
```

---

### Task 4: Replace docs/CLAUDE.md with Redirect

**Files:**
- Modify: `docs/CLAUDE.md`

**Step 1: Replace docs/CLAUDE.md content**

Replace the entire content with:

```markdown
# Claude Code Instructions

See the root [CLAUDE.md](../CLAUDE.md) for all development standards and conventions.

This file is kept as a pointer. The root CLAUDE.md is the source of truth.
```

**Step 2: Commit**

```bash
git add docs/CLAUDE.md
git commit -m "docs: redirect docs/CLAUDE.md to root CLAUDE.md"
```

---

### Task 5: Fix docs/README.md

**Files:**
- Modify: `docs/README.md`

**Step 1: Update docs/README.md**

Replace entire content with:

```markdown
# LLM Survey Platform (v1)

A SurveyMonkey-style platform for running structured prompt surveys against multiple LLM chat APIs.

**Tech:** Next.js 16 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, Prisma + MySQL, custom MySQL-backed job queue, SSE for live progress.

For setup instructions, see the root [README.md](../README.md).
For development standards, see [CLAUDE.md](../CLAUDE.md).
For contributor workflow, see [CONTRIBUTING.md](../CONTRIBUTING.md).
```

**Step 2: Commit**

```bash
git add docs/README.md
git commit -m "docs: fix docs/README.md — correct tech stack, add links to root docs"
```

---

### Task 6: Rewrite docs/QUEUE_AND_WORKERS.md

**Files:**
- Modify: `docs/QUEUE_AND_WORKERS.md`

**Step 1: Rewrite for MySQL polling worker**

Replace entire content with:

```markdown
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
```

**Step 2: Commit**

```bash
git add docs/QUEUE_AND_WORKERS.md
git commit -m "docs: rewrite QUEUE_AND_WORKERS for MySQL polling worker (was pg-boss)"
```

---

### Task 7: Fix docs/DATA_MODEL.md

**Files:**
- Modify: `docs/DATA_MODEL.md`

**Step 1: Update with correct DB and complete entity list**

Replace entire content with:

```markdown
# Data Model

Database: MySQL via Prisma ORM. Schema: `prisma/schema.prisma`.

## Entities

| Model | Purpose |
|-------|---------|
| `User` | Email/password auth, role (USER/ADMIN) |
| `Survey` | Survey container with title, description, soft-delete |
| `SurveyShare` | Share a survey with another user (VIEW/EDIT role) |
| `Variable` | Template variable for prompt substitution (`{{key}}`) |
| `Question` | Prompt template with mode (STATELESS/THREADED) |
| `ModelTarget` | LLM model catalog (provider, model name, cost info) |
| `SurveyRun` | Execution instance with status, settings, limits |
| `RunModel` | Junction: which models are included in a run |
| `ConversationThread` | Message history for threaded questions |
| `Job` | Queue item (type, status, payload, idempotency key) |
| `LlmResponse` | Raw + parsed LLM output, usage stats, cost |
| `AnalysisResult` | NLP analysis (sentiment, entities, flags) |
| `AuditEvent` | Audit log for user actions |

## Enums

- `UserRole`: USER, ADMIN
- `ShareRole`: VIEW, EDIT
- `QuestionMode`: STATELESS, THREADED
- `Provider`: OPENAI, ANTHROPIC, GEMINI, PERPLEXITY, COPILOT
- `RunStatus`: DRAFT, QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
- `JobType`: EXECUTE_QUESTION, ANALYZE_RESPONSE, EXPORT_RUN
- `JobStatus`: PENDING, RUNNING, SUCCEEDED, FAILED, RETRYING, CANCELLED
```

**Step 2: Commit**

```bash
git add docs/DATA_MODEL.md
git commit -m "docs: fix DATA_MODEL — correct DB to MySQL, add complete entity/enum list"
```

---

### Task 8: Fix docs/ARCHITECTURE.md

**Files:**
- Modify: `docs/ARCHITECTURE.md`

**Step 1: Update architecture description**

Replace entire content with:

```markdown
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
```

**Step 2: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: fix ARCHITECTURE — update for MySQL worker, add key decisions"
```

---

### Task 9: Fix docs/DEPLOYMENT_VPS.md

**Files:**
- Modify: `docs/DEPLOYMENT_VPS.md`

**Step 1: Update deployment doc**

Replace entire content with:

```markdown
# VPS Deployment

## Option A: Docker Compose

Containerize the web app and worker. Use a managed MySQL instance or MySQL container.

## Option B: Node + systemd + Nginx

Run web and worker as separate systemd services behind Nginx reverse proxy.

### Requirements

- Node.js 18+
- MySQL 8+
- Nginx
- pnpm

### Process

1. Clone repo, `pnpm install --frozen-lockfile`
2. Configure `.env` (DATABASE_URL pointing to MySQL, JWT_SECRET, API keys)
3. `pnpm prisma:migrate && pnpm seed`
4. `pnpm build`
5. Run web: `pnpm start` (systemd service)
6. Run worker: `pnpm worker` (separate systemd service)
7. Nginx reverse proxy with SSE support for `/api/runs/`
8. TLS via Let's Encrypt / certbot
```

**Step 2: Commit**

```bash
git add docs/DEPLOYMENT_VPS.md
git commit -m "docs: fix DEPLOYMENT_VPS — correct to MySQL, update requirements"
```

---

### Task 10: Fix docs/SECURITY.md

**Files:**
- Modify: `docs/SECURITY.md`

**Step 1: Update security doc**

Replace entire content with:

```markdown
# Security

- **Authentication:** Email + password credentials
- **Password hashing:** bcrypt (12 rounds) via `src/lib/auth.ts`
- **Sessions:** httpOnly JWT cookies (HS256, signed with `JWT_SECRET`)
- **Route protection:** Middleware (`src/middleware.ts`) guards all `/app/*` routes
- **Authorization:** Survey-level sharing with VIEW/EDIT roles via `src/lib/survey-auth.ts`
- **Audit logging:** All sensitive operations logged to `AuditEvent` table via `src/lib/audit.ts`
- **Secrets:** API keys and credentials stored in `.env` only (gitignored). Accessed via typed helpers in `src/lib/env.ts`.
- **Input validation:** All server action inputs validated with Zod schemas from `src/lib/schemas.ts`
```

**Step 2: Commit**

```bash
git add docs/SECURITY.md
git commit -m "docs: fix SECURITY — correct to bcrypt only, add detail on all security layers"
```

---

### Task 11: Clean Up Stale Dev Dependency

**Files:**
- Modify: `package.json`

**Step 1: Remove `@types/pg` from devDependencies**

The project uses MySQL, not Postgres. `@types/pg` is a leftover from when the docs said Postgres. Remove it.

In `package.json`, delete the line:
```
"@types/pg": "^8.16.0",
```

**Step 2: Run pnpm install to update lockfile**

Run: `pnpm install`
Expected: Lockfile updated, no errors.

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: remove stale @types/pg dependency (project uses MySQL)"
```

---

### Task 12: Final Verification

**Step 1: Run lint**

Run: `pnpm lint`
Expected: No errors.

**Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors.

**Step 3: Run tests**

Run: `pnpm test`
Expected: All tests pass.

**Step 4: Verify all docs are consistent**

Read through each doc file and confirm no remaining references to "Postgres", "pg-boss", or port 3000.

Run: `grep -ri "postgres\|pg-boss\|pg_boss\|localhost:3000" README.md CONTRIBUTING.md CLAUDE.md docs/`
Expected: No matches (zero output).
