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
