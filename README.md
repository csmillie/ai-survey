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
     # Production: next start defaults to port 3000 (dev uses 5001)
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
