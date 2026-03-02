module.exports = {
  apps: [
    {
      name: "ai-survey-web",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      cwd: "/var/www/survey.yourdomain.com/web",
      env: { NODE_ENV: "production" },
    },
    {
      name: "ai-survey-worker",
      script: "node_modules/.bin/tsx",
      args: "src/worker/index.ts",
      cwd: "/var/www/survey.yourdomain.com/web",
      env: { NODE_ENV: "production" },
    },
    {
      name: "ai-survey-webhook",
      script: "scripts/webhook.mjs",
      cwd: "/var/www/survey.yourdomain.com/web",
      env: {
        NODE_ENV: "production",
        WEBHOOK_PORT: "9000",
        DEPLOY_BRANCH: "main",
        // WEBHOOK_SECRET is read from .env — set it there, not here.
      },
    },
  ],
};
