function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function optionalEnvInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(
      `Environment variable ${key} must be an integer, got: ${raw}`
    );
  }
  return parsed;
}

function optionalEnvFloat(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(
      `Environment variable ${key} must be a number, got: ${raw}`
    );
  }
  return parsed;
}

function optionalEnvBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (!raw) return fallback;
  return raw === "true" || raw === "1";
}

export function getDatabaseUrl(): string {
  return requiredEnv("DATABASE_URL");
}

export function getJwtSecret(): string {
  const secret = requiredEnv("JWT_SECRET");
  if (secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters for HS256 security"
    );
  }
  return secret;
}

export function getSessionMaxAgeSeconds(): number {
  return optionalEnvInt("SESSION_MAX_AGE_SECONDS", 86_400);
}

export function getAdminEmails(): string[] {
  const raw = optionalEnv("ADMIN_EMAILS", "");
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

export function getAdminDefaultPassword(): string {
  return requiredEnv("ADMIN_DEFAULT_PASSWORD");
}

export function getOpenaiApiKey(): string {
  return requiredEnv("OPENAI_API_KEY");
}

export function getAnthropicApiKey(): string {
  return requiredEnv("ANTHROPIC_API_KEY");
}

export function getGeminiApiKey(): string {
  return requiredEnv("GEMINI_API_KEY");
}

export function getXaiApiKey(): string {
  return requiredEnv("XAI_API_KEY");
}

export function getMaxTokensPerRun(): number {
  return optionalEnvInt("MAX_TOKENS_PER_RUN", 1_000_000);
}

export function getMaxCostPerRunUsd(): number {
  return optionalEnvFloat("MAX_COST_PER_RUN_USD", 50);
}

export function getEnableLlmAnalysisRepass(): boolean {
  return optionalEnvBool("ENABLE_LLM_ANALYSIS_REPASS", false);
}

export function getMaxConcurrentRunsPerUser(): number {
  return optionalEnvInt("MAX_CONCURRENT_RUNS_PER_USER", 5);
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getEmailEncryptionKey(): string | undefined {
  const val = optionalEnv("EMAIL_ENCRYPTION_KEY", "");
  return val || undefined;
}

export function getBetaNotifyEmail(): string | undefined {
  const val = optionalEnv("BETA_NOTIFY_EMAIL", "");
  return val || undefined;
}
