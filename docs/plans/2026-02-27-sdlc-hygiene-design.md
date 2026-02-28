# SDLC Hygiene Design — Claude Code-Centric Approach

**Date:** 2026-02-27
**Status:** Approved

## Context

LLM Survey Platform v1 — a Next.js 16 + TypeScript + Prisma + MySQL application with a custom polling job queue worker. Team of 2-3 developers, all using Claude Code. Pre-deployment stage.

The project has doc drift (docs reference Postgres/pg-boss but implementation uses MySQL with custom polling worker) and no established SDLC conventions.

## Approach

CLAUDE.md-centric: leverage Claude Code's automatic reading of CLAUDE.md to enforce all development standards. Minimal external tooling. Fix existing doc inconsistencies.

## Deliverables

### 1. Root CLAUDE.md — Enforcement Engine

Comprehensive file covering:

- **Project overview** — tech stack, architecture summary
- **Development workflow** — branch strategy (`feat/`, `fix/`), conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`), PR workflow
- **Pre-commit checks** — `pnpm lint && pnpm tsc --noEmit && pnpm test`
- **Code standards** — TypeScript strict (no `any`), Zod validation at boundaries, server action patterns, Prisma migration workflow
- **Architecture rules** — file organization, naming, import patterns
- **Testing standards** — what to test, where tests go, how to run
- **Documentation rules** — when to update, keep synced with implementation
- **Security** — no secrets in code, audit logging, input validation

### 2. Root CONTRIBUTING.md

Human-readable guide:
- Dev environment setup (clone, install, env, migrate, seed)
- Branch and PR workflow with examples
- Commit message format with examples
- Testing expectations
- Code review norms
- Architecture doc locations

### 3. Doc Fixes

| Doc | Fix |
|-----|-----|
| `docs/CLAUDE.md` | Remove or redirect to root CLAUDE.md |
| `docs/QUEUE_AND_WORKERS.md` | Rewrite for MySQL polling worker |
| `docs/DATA_MODEL.md` | Verify and sync with schema.prisma |
| `docs/ARCHITECTURE.md` | Update queue/worker references |
| `docs/DEPLOYMENT_VPS.md` | MySQL instead of Postgres |
| `docs/SECURITY.md` | Verify accuracy |
| `README.md` | Fix port (5001), accurate tech stack |

### Out of Scope (YAGNI)

- CI/CD pipeline (not deployed yet)
- Husky/lint-staged hooks
- commitlint tooling
- Branch protection rules
