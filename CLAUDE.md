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
- Use `src/lib/env.ts` typed accessors for all environment variables. Never read `process.env` directly. Exception: `src/worker/index.ts` runs as a standalone `tsx` process outside Next.js and cannot use `@/` path aliases.
- Server Actions return `{ success: boolean; error?: string }` patterns.
- LLM responses go through `src/lib/json-repair.ts` for resilient parsing.

### Security

- Never commit secrets or API keys. All secrets go in `.env` (gitignored).
- Passwords hashed with bcrypt (12 rounds) via `src/lib/auth.ts`.
- Sessions are httpOnly JWT cookies (HS256, signed with `JWT_SECRET`).
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
