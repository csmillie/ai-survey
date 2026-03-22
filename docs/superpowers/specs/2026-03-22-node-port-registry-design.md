# Node Port Registry Convention

## Problem

Multiple Node.js sites on a shared ISPConfig server use PM2 and Apache reverse proxies. Without a central port registry, sites can be configured on the same port, causing `EADDRINUSE` crash loops and downtime.

## Solution

A plain-text registry file at `/etc/node-ports.conf` on the production server, enforced by CLAUDE.md instructions in every Node project. Claude Code checks and updates the registry whenever configuring ports.

## Registry File

### Location

`/etc/node-ports.conf` on the production server.

### Format

```
# /etc/node-ports.conf — Node.js Port Assignments
# Managed by convention via CLAUDE.md instructions in each project.
# Format: port | app-name | domain | description
#
# Reserved ranges:
#   3000-3099  Web application servers
#   9000-9099  Webhooks and internal services
#
# ── Web Apps ──────────────────────────────────────────────────
3000 | other-site          | example.com      | Next.js web
3001 | ai-survey           | modeltrust.app   | Next.js web
# ── Webhooks / Internal ──────────────────────────────────────
9000 | ai-survey-webhook   | modeltrust.app   | GitHub deploy webhook
```

### Rules

- One line per port assignment.
- Ports are unique — no two entries may share the same port number.
- Use the `3000-3099` range for web app servers.
- Use the `9000-9099` range for webhooks and internal services.
- Comments and blank lines are allowed for organization.
- When removing a site, delete its line (do not comment it out — commented-out lines risk being mistaken for active reservations).
- If a range fills up, extend to the next hundred (`3100-3199` or `9100-9199`) and update the reserved ranges comment in the file header.
- This registry is for the production server only. Local development does not use this file.

## CLAUDE.md Instructions

The following block is added to each Node project's `CLAUDE.md`. It tells Claude Code how to interact with the registry.

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

\`\`\`bash
awk -F'|' '/^[0-9]/{p=$1+0; if(seen[p]++) print "DUPLICATE: " p}' /etc/node-ports.conf
\`\`\`

### This Project's Ports

Check `/etc/node-ports.conf` on the production server for the current assignments for this project. The port variables are set in `.env` and referenced in the PM2 config.
```

## Setup Steps

1. **Create the registry file** on the production server:
   ```bash
   sudo touch /etc/node-ports.conf
   sudo chown root:sudo /etc/node-ports.conf
   sudo chmod 664 /etc/node-ports.conf
   ```
   The group-writable permission allows non-root deploy users to update the file.

2. **Populate it** by auditing each project's `.env` file for `PORT` and `WEBHOOK_PORT` values. Cross-reference with `pm2 list` to confirm which apps are running. Write one line per port to `/etc/node-ports.conf`.

3. **Add the CLAUDE.md instructions** (from the section above) to each Node project's `CLAUDE.md`.

4. **Verify each project's `.env`** has an explicit `PORT` set matching its registry entry — no more relying on defaults.

## What This Does Not Do

- No runtime enforcement — if someone manually sets a conflicting port, this won't stop them.
- No deploy-time validation script — the convention relies on Claude Code following the CLAUDE.md instructions.
- No ISPConfig integration — ISPConfig continues to manage Apache vhosts and proxy directives independently.
