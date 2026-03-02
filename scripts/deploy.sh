#!/usr/bin/env bash
#
# deploy.sh — Zero-downtime deployment for the AI Survey Platform.
#
# Pulls latest code from the main branch, installs dependencies,
# runs database migrations, rebuilds, and restarts PM2 processes.
#
# Usage:
#   ./scripts/deploy.sh [--force]
#
# Options:
#   --force   Remove the lock directory and deploy even if a previous deploy is
#             still marked as running (e.g. after a crashed deploy).
#
# Environment:
#   DEPLOY_DIR     Override the working directory (default: script's grandparent)
#   DEPLOY_BRANCH  Override the branch to deploy (default: main)
#
set -euo pipefail

# ── Configuration ───────────────────────────────────────────────────────────

DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
LOCK_DIR="${DEPLOY_DIR}/deploy.lock"
LOG_DIR="${DEPLOY_DIR}/logs"
LOG_FILE="${LOG_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"
MAX_LOG_FILES=20

# ── Helpers ─────────────────────────────────────────────────────────────────

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG_FILE"; }
die() { log "FATAL: $*"; exit 1; }

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
  log "Lock released."
}

# Prune deploy logs, keeping only the most recent $MAX_LOG_FILES.
prune_logs() {
  local count
  count=$(find "$LOG_DIR" -maxdepth 1 -name 'deploy-*.log' -type f | wc -l)
  if (( count > MAX_LOG_FILES )); then
    find "$LOG_DIR" -maxdepth 1 -name 'deploy-*.log' -type f -printf '%T@ %p\n' \
      | sort -n \
      | head -n $(( count - MAX_LOG_FILES )) \
      | cut -d' ' -f2- \
      | xargs rm -f
    log "Pruned old deploy logs (kept most recent ${MAX_LOG_FILES})."
  fi
}

# ── Pre-flight ──────────────────────────────────────────────────────────────

mkdir -p "$LOG_DIR"

if [[ "${1:-}" == "--force" ]]; then
  rmdir "$LOCK_DIR" 2>/dev/null || rm -rf "$LOCK_DIR"
  log "Forced removal of stale lock."
fi

# mkdir is atomic on POSIX — only one process can succeed.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  die "Another deploy is running (lock exists at ${LOCK_DIR}). Use --force to override."
fi
trap cleanup EXIT

cd "$DEPLOY_DIR"
log "Starting deploy in ${DEPLOY_DIR} (branch: ${DEPLOY_BRANCH})"

# ── 1. Pull latest code ────────────────────────────────────────────────────

log "Fetching from origin..."
git fetch origin "$DEPLOY_BRANCH"

LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse "origin/${DEPLOY_BRANCH}")

if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
  log "Already up to date at ${LOCAL_SHA:0:8}. Nothing to deploy."
  exit 0
fi

log "Updating ${LOCAL_SHA:0:8} → ${REMOTE_SHA:0:8}"
git reset --hard "origin/${DEPLOY_BRANCH}"

# ── 2. Install dependencies ────────────────────────────────────────────────

log "Installing dependencies..."
pnpm install --frozen-lockfile

# ── 3. Generate Prisma client ──────────────────────────────────────────────

log "Generating Prisma client..."
pnpm prisma:generate

# ── 4. Run database migrations ─────────────────────────────────────────────

log "Running database migrations..."
pnpm prisma migrate deploy

# ── 5. Build ────────────────────────────────────────────────────────────────

log "Building Next.js..."
pnpm build

# ── 6. Restart PM2 processes ───────────────────────────────────────────────

log "Restarting PM2 processes..."
pm2 reload ecosystem.config.js

# ── 7. Health check ────────────────────────────────────────────────────────

log "Verifying PM2 processes..."
sleep 3

FAILED_APPS=$(pm2 jlist 2>/dev/null \
  | node -e "
    const apps = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const failed = apps.filter(a => a.pm2_env?.status !== 'online' && a.name.startsWith('ai-survey'));
    if (failed.length) { console.log(failed.map(a => a.name).join(', ')); process.exit(1); }
  " 2>&1) || true

if [[ -n "$FAILED_APPS" ]]; then
  log "WARNING: These processes are not online: ${FAILED_APPS}"
  log "Run 'pm2 logs' to investigate."
else
  log "All ai-survey processes are online."
fi

# ── 8. Log rotation ────────────────────────────────────────────────────────

prune_logs

# ── Done ────────────────────────────────────────────────────────────────────

NEW_SHA=$(git rev-parse HEAD)
log "Deploy complete! Now running ${NEW_SHA:0:8}"
