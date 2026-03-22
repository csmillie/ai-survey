# Node Port Registry Convention — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a shared port registry convention across all Node.js projects on the production server, enforced by CLAUDE.md instructions.

**Architecture:** A plain-text file at `/etc/node-ports.conf` on the production server serves as the single source of truth for port assignments. Each project's CLAUDE.md includes instructions telling Claude Code to check and update this file before assigning ports. No code changes — convention only.

**Tech Stack:** Plain text, CLAUDE.md, bash (server setup only)

**Spec:** `docs/superpowers/specs/2026-03-22-node-port-registry-design.md`

---

### Task 1: Add Port Registry section to this project's CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (append new section after the "Running Locally" section)

- [ ] **Step 1: Add the Port Registry section to CLAUDE.md**

Append this section at the end of `CLAUDE.md`:

```markdown
## Port Registry (Production Server)

This server uses a shared port registry at `/etc/node-ports.conf` to prevent port conflicts between Node.js sites managed by PM2.

### Rules

- **Before assigning or changing a PORT value** (in `.env`, `ecosystem.config.js`, or any config), read `/etc/node-ports.conf` on the production server to check which ports are already claimed.
- **Pick the next available port** in the appropriate range:
  - `3000-3099` for web application servers
  - `9000-9099` for webhooks and internal services
- **Update `/etc/node-ports.conf`** with the new entry after assigning a port. Use the format: `port | app-name | domain | description`
- **Never reuse a port** that is already listed in the registry, even if the other site appears to be stopped.
- **When decommissioning a site**, remove its line from the registry.
- **When setting up a new project**, register all ports it needs (web server, webhook listener, etc.) before the first deploy.

### Verifying the Registry

After making changes, check for duplicate ports:

```bash
awk -F'|' '/^[0-9]/{p=$1+0; if(seen[p]++) print "DUPLICATE: " p}' /etc/node-ports.conf
```

### This Project's Ports

Check `/etc/node-ports.conf` on the production server for the current assignments for this project. The port variables are set in `.env` and referenced in the PM2 config.
```

- [ ] **Step 2: Verify the edit looks correct**

Read the updated `CLAUDE.md` and confirm the new section is well-formatted and doesn't break existing content.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add port registry convention to CLAUDE.md"
```

---

### Task 2: Set up the registry file on the production server

These are manual steps for the user to run on the production server via SSH.

- [ ] **Step 1: Create the registry file**

```bash
sudo touch /etc/node-ports.conf
sudo chown root:sudo /etc/node-ports.conf
sudo chmod 664 /etc/node-ports.conf
```

- [ ] **Step 2: Audit current port assignments**

Check each project's `.env` file for `PORT` and `WEBHOOK_PORT` values. Cross-reference with `pm2 list` output to confirm which apps are running and on which ports.

- [ ] **Step 3: Populate the registry file**

Write the initial contents based on the audit. Example:

```bash
cat > /etc/node-ports.conf << 'EOF'
# /etc/node-ports.conf — Node.js Port Assignments
# Managed by convention via CLAUDE.md instructions in each project.
# Format: port | app-name | domain | description
#
# Reserved ranges:
#   3000-3099  Web application servers
#   9000-9099  Webhooks and internal services
#
# ── Web Apps ──────────────────────────────────────────────────
3000 | <site-name>         | <domain>         | <description>
3088 | ai-survey           | modeltrust.app   | Next.js web
# ── Webhooks / Internal ──────────────────────────────────────
9088 | ai-survey-webhook   | modeltrust.app   | GitHub deploy webhook
EOF
```

Replace the `<placeholder>` entries with actual site data from the audit.

- [ ] **Step 3b: Verify no duplicate ports**

```bash
awk -F'|' '/^[0-9]/{p=$1+0; if(seen[p]++) print "DUPLICATE: " p}' /etc/node-ports.conf
```

Expected: no output (no duplicates).

- [ ] **Step 4: Fix the ai-survey port conflict (if needed)**

If the ai-survey `.env` already has an explicit `PORT` matching its registry entry, skip this step. Otherwise, update it:

```bash
# In /var/www/.../ai-survey/.env
PORT=3088
```

Then restart:

```bash
pm2 restart ai-survey-web
```

- [ ] **Step 5: Verify the site is back online**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3088
```

Expected: `200` (or `302` redirect to login)

---

### Task 3: Create reusable CLAUDE.md snippet for other projects

**Files:**
- Create: `docs/port-registry-claude-instructions.md`

- [ ] **Step 1: Write the standalone instruction file**

This is a copy-paste reference for adding the port registry section to other projects' CLAUDE.md files. It should be self-contained — no references to ai-survey-specific details.

```markdown
# Port Registry — CLAUDE.md Instructions

Copy the section below into any Node.js project's `CLAUDE.md` that runs on the shared ISPConfig production server.

---

## Port Registry (Production Server)

This server uses a shared port registry at `/etc/node-ports.conf` to prevent port conflicts between Node.js sites managed by PM2.

### Rules

- **Before assigning or changing a PORT value** (in `.env`, `ecosystem.config.js`, or any config), read `/etc/node-ports.conf` on the production server to check which ports are already claimed.
- **Pick the next available port** in the appropriate range:
  - `3000-3099` for web application servers
  - `9000-9099` for webhooks and internal services
- **Update `/etc/node-ports.conf`** with the new entry after assigning a port. Use the format: `port | app-name | domain | description`
- **Never reuse a port** that is already listed in the registry, even if the other site appears to be stopped.
- **When decommissioning a site**, remove its line from the registry.
- **When setting up a new project**, register all ports it needs (web server, webhook listener, etc.) before the first deploy.

### Verifying the Registry

After making changes, check for duplicate ports:

```bash
awk -F'|' '/^[0-9]/{p=$1+0; if(seen[p]++) print "DUPLICATE: " p}' /etc/node-ports.conf
```

### This Project's Ports

Check `/etc/node-ports.conf` on the production server for the current assignments for this project. The port variables are set in `.env` and referenced in the PM2 config.
```

- [ ] **Step 2: Commit**

```bash
git add docs/port-registry-claude-instructions.md
git commit -m "docs: add reusable port registry CLAUDE.md snippet"
```
