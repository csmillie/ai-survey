#!/usr/bin/env node
/**
 * webhook.mjs — Lightweight GitHub webhook listener for auto-deploy.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, crypto,
 * child_process, fs). Designed to run under PM2 alongside the web app and
 * worker.
 *
 * Environment variables (loaded from ../.env automatically):
 *   WEBHOOK_SECRET   GitHub webhook secret (required)
 *   WEBHOOK_PORT     Port to listen on (default: 9088)
 *   DEPLOY_BRANCH    Branch to deploy on push (default: main)
 *
 * Setup:
 *   1. Generate a secret:  openssl rand -hex 32
 *   2. Add WEBHOOK_SECRET to your .env
 *   3. In GitHub → repo Settings → Webhooks → Add webhook:
 *        Payload URL:  https://survey.yourdomain.com/webhook  (proxied) or
 *                      http://your-server-ip:9088/webhook     (direct)
 *        Content type: application/json
 *        Secret:       <same value as WEBHOOK_SECRET>
 *        Events:       Just the push event
 */

import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ── Load .env ─────────────────────────────────────────────────────────────
// PM2 does not load .env files automatically. Parse it ourselves to avoid
// adding a dotenv dependency.

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

try {
  const envPath = join(PROJECT_ROOT, ".env");
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Only set if not already defined (real env vars take precedence)
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
} catch {
  // .env file is optional — environment variables may be set directly
}

// ── Configuration ──────────────────────────────────────────────────────────

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  console.error("FATAL: WEBHOOK_SECRET environment variable is required.");
  console.error("Set it in .env or pass it directly via the environment.");
  process.exit(1);
}

const PORT = parseInt(process.env.WEBHOOK_PORT || "9088", 10);
const DEPLOY_BRANCH = process.env.DEPLOY_BRANCH || "main";
const DEPLOY_SCRIPT = join(__dirname, "deploy.sh");

// Max request body size (1 MB) — reject oversized payloads before signature
// verification to prevent memory exhaustion from unauthenticated requests.
const MAX_BODY_BYTES = 1024 * 1024;

// ── Helpers ────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/** Verify the GitHub HMAC-SHA256 signature. */
function verifySignature(payload, signature) {
  if (!signature) return false;

  const expected = `sha256=${createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex")}`;

  // Length mismatch means the signature is invalid
  if (expected.length !== signature.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** Read the request body with a size limit. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error(`Request body exceeds ${MAX_BODY_BYTES} bytes`));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/** Run the deploy script asynchronously and log output. */
function runDeploy() {
  log("Spawning deploy script...");

  execFile("/usr/bin/env", ["bash", DEPLOY_SCRIPT], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DEPLOY_BRANCH },
    timeout: 5 * 60 * 1000, // 5 minute timeout
  }, (error, stdout, stderr) => {
    if (stdout) log(`deploy stdout:\n${stdout}`);
    if (stderr) log(`deploy stderr:\n${stderr}`);
    if (error) {
      log(`Deploy failed: ${error.message}`);
    } else {
      log("Deploy completed successfully.");
    }
  });
}

// ── Server ─────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Only accept POST /webhook
  if (req.method !== "POST" || req.url !== "/webhook") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  try {
    const body = await readBody(req);
    const signature = req.headers["x-hub-signature-256"];

    // Verify signature
    if (!verifySignature(body, signature)) {
      log("Rejected: invalid signature");
      res.writeHead(401);
      res.end("Invalid signature");
      return;
    }

    const payload = JSON.parse(body);
    const event = req.headers["x-github-event"];

    // Only deploy on push to the configured branch
    if (event !== "push") {
      log(`Ignoring event: ${event}`);
      res.writeHead(200);
      res.end("Ignored (not a push event)");
      return;
    }

    const branch = payload.ref?.replace("refs/heads/", "");
    if (branch !== DEPLOY_BRANCH) {
      log(`Ignoring push to ${branch} (only deploying ${DEPLOY_BRANCH})`);
      res.writeHead(200);
      res.end(`Ignored (push to ${branch}, not ${DEPLOY_BRANCH})`);
      return;
    }

    const pusher = payload.pusher?.name || "unknown";
    const message = (payload.head_commit?.message || "no message").split("\n")[0];
    log(`Push to ${DEPLOY_BRANCH} by ${pusher}: ${message}`);

    // Respond immediately, deploy asynchronously
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "deploying" }));

    runDeploy();
  } catch (err) {
    log(`Error processing webhook: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(err.message.includes("exceeds") ? 413 : 500);
      res.end(err.message.includes("exceeds") ? "Payload too large" : "Internal error");
    }
  }
});

server.listen(PORT, () => {
  log(`Webhook listener running on port ${PORT}`);
  log(`Deploying branch: ${DEPLOY_BRANCH}`);
  log(`Deploy script: ${DEPLOY_SCRIPT}`);
});
