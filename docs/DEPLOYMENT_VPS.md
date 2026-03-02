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

---

## Auto-Deploy via GitHub Webhook

Automatically deploy when code is pushed to `main`. Uses a lightweight Node.js
webhook listener (`scripts/webhook.mjs`) that verifies GitHub signatures and
triggers the deploy script (`scripts/deploy.sh`).

### How It Works

```
GitHub push → webhook POST → signature verified → deploy.sh runs:
  git pull → pnpm install → prisma migrate deploy → pnpm build → pm2 reload
```

The deploy script uses a lock file to prevent concurrent deploys and skips
deployment entirely if the local SHA already matches the remote.

### Setup

#### 1. Generate a webhook secret

```bash
openssl rand -hex 32
```

Add the result to your `.env` file:

```
WEBHOOK_SECRET="<generated-secret>"
WEBHOOK_PORT=9000
DEPLOY_BRANCH=main
```

#### 2. Start all processes with PM2

The `ecosystem.config.cjs` in the repo root includes the web app, worker, and
webhook listener. Edit the `cwd` paths to match your server layout, then:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

Verify the webhook listener is running:

```bash
curl http://localhost:9000/health
# → {"status":"ok"}
```

#### 3. Configure the GitHub webhook

In your GitHub repo → **Settings** → **Webhooks** → **Add webhook**:

| Field          | Value                                            |
|----------------|--------------------------------------------------|
| Payload URL    | `https://survey.yourdomain.com/webhook`          |
| Content type   | `application/json`                               |
| Secret         | Same value as `WEBHOOK_SECRET` in `.env`         |
| Events         | **Just the push event**                          |

#### 4. Proxy the webhook through Apache (recommended)

Add to your Apache Directives in ISPConfig (alongside your existing proxy rules):

```apache
# Webhook endpoint → webhook listener on port 9000
ProxyPass /webhook http://127.0.0.1:9000/webhook
ProxyPassReverse /webhook http://127.0.0.1:9000/webhook
```

This routes `https://survey.yourdomain.com/webhook` through your existing
SSL-terminated Apache vhost to the webhook listener.

Alternatively, if you prefer to expose the webhook port directly, use the direct
URL in GitHub (`http://your-server-ip:9000/webhook`) and ensure port 9000 is
open in your firewall.

#### 5. Test it

Push a commit to `main` and watch the logs:

```bash
pm2 logs ai-survey-webhook
```

You should see the signature verification, then the deploy script output.

### Manual deploy

You can also trigger a deploy manually at any time:

```bash
cd /var/www/survey.yourdomain.com/web
./scripts/deploy.sh
```

Use `--force` to clear a stale lock file from a crashed deploy:

```bash
./scripts/deploy.sh --force
```

### Deploy logs

Deploy logs are written to the `logs/` directory (gitignored):

```bash
ls logs/deploy-*.log
tail -f logs/deploy-$(date +%Y%m%d)*.log
```

### Troubleshooting

| Symptom | Fix |
|---|---|
| `invalid signature` in webhook logs | Verify `WEBHOOK_SECRET` matches in both `.env` and GitHub webhook settings |
| `Another deploy is running` | A previous deploy crashed. Run `./scripts/deploy.sh --force` |
| Deploy succeeds but app doesn't update | Check `pm2 list` — all processes should show `online`. Check `pm2 logs ai-survey-web` for startup errors |
| Webhook not receiving events | Check GitHub webhook delivery log (Settings → Webhooks → Recent Deliveries). Verify Apache proxy or firewall rules |
