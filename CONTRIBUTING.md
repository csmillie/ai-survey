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
