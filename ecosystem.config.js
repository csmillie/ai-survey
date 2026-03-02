const path = require("path");

// Resolve project root from this file's location, so the config works
// regardless of where the repo is cloned on the server.
const cwd = path.resolve(__dirname);

module.exports = {
  apps: [
    {
      name: "ai-survey-web",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      cwd,
      env: { NODE_ENV: "production" },
    },
    {
      name: "ai-survey-worker",
      script: "node_modules/.bin/tsx",
      args: "src/worker/index.ts",
      cwd,
      env: { NODE_ENV: "production" },
    },
    {
      name: "ai-survey-webhook",
      script: "scripts/webhook.mjs",
      cwd,
      env: {
        NODE_ENV: "production",
        WEBHOOK_PORT: "9000",
        DEPLOY_BRANCH: "main",
      },
    },
  ],
};
