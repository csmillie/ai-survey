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
#   --force   Remove the lock file and deploy even if a previous deploy is
#             still marked as running (e.g. after a crashed deploy).
#
# Environment:
#   DEPLOY_DIR   Override the working directory (default: script's grandparent)
#   DEPLOY_BRANCH Override the branch to deploy (default: main)
#
set -euo pipefail

# ── Configuration ───────────────────────────────────────────────────────────

DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
LOCK_FILE="${DEPLOY_DIR}/deploy.lock"
LOG_DIR="${DEPLOY_DIR}/logs"
LOG_FILE="${LOG_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"

# ── Helpers ─────────────────────────────────────────────────────────────────

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG_FILE"; }
die() { log "FATAL: $*"; exit 1; }

cleanup() {
  rm -f "$LOCK_FILE"
  log "Lock released."
}

# ── Pre-flight ──────────────────────────────────────────────────────────────

mkdir -p "$LOG_DIR"

if [[ "${1:-}" == "--force" ]]; then
  rm -f "$LOCK_FILE"
  log "Forced removal of stale lock file."
fi

if [[ -f "$LOCK_FILE" ]]; then
  die "Another deploy is running (lock file exists). Use --force to override."
fi

echo $$ > "$LOCK_FILE"
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

# ── Done ────────────────────────────────────────────────────────────────────

NEW_SHA=$(git rev-parse HEAD)
log "Deploy complete! Now running ${NEW_SHA:0:8}"
