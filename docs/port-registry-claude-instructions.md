# Port Registry — CLAUDE.md Instructions

Copy the section below into any Node.js project's `CLAUDE.md` that runs on the shared ISPConfig production server.

---

## Port Registry

All Node.js projects use a shared port registry to prevent port conflicts between sites managed by PM2. The same ports are used in both local development and production.

### Registry Locations

- **Local development:** `~/.node-ports.conf`
- **Production server:** `/etc/node-ports.conf`

Both files use the same format and must stay in sync. When assigning or changing a port, update both files.

### Rules

- **Before assigning or changing a PORT value** (in `.env`, `ecosystem.config.js`, `package.json`, or any config), read the port registry to check which ports are already claimed.
- **Pick the next available port** in the appropriate range:
  - `3000-3099` for web application servers
  - `9000-9099` for webhooks and internal services
- **Update both `~/.node-ports.conf` and `/etc/node-ports.conf`** with the new entry after assigning a port. Use the format: `port | app-name | domain | description`
- **Never reuse a port** that is already listed in the registry, even if the other site appears to be stopped.
- **Local and production ports must match.** Dev servers, production servers, and all config files (`.env`, `.env.example`, `package.json`, `ecosystem.config.js`) must use the same port for a given app.
- **When decommissioning a site**, remove its line from both registry files.
- **When setting up a new project**, register all ports it needs (web server, webhook listener, etc.) in both registry files before the first deploy.

### Verifying the Registry

After making changes, check for duplicate ports:

```bash
awk -F'|' '/^[0-9]/{p=$1+0; if(seen[p]++) print "DUPLICATE: " p}' ~/.node-ports.conf
```

### This Project's Ports

Check `~/.node-ports.conf` (or `/etc/node-ports.conf` on the server) for the current assignments for this project. The port variables are set in `.env` and referenced in `package.json` and `ecosystem.config.js`.
