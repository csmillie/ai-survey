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
