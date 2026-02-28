import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // -------------------------------------------------------------------------
  // 1. Seed admin users
  // -------------------------------------------------------------------------
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD ?? "changeme123";
  const passwordHash = await hash(defaultPassword, 12);

  for (const email of adminEmails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: "ADMIN", passwordHash },
      create: { email, passwordHash, role: "ADMIN" },
    });
    console.log(`Admin user ${user.email} — ${user.id} (upserted)`);
  }

  // -------------------------------------------------------------------------
  // 2. Seed default model targets
  // -------------------------------------------------------------------------
  const modelTargets = [
    {
      provider: "OPENAI" as const,
      modelName: "gpt-4o-mini",
      isEnabled: true,
      isDefaultCostEffective: true,
      inputTokenCostUsd: 0.00015,
      outputTokenCostUsd: 0.0006,
    },
    {
      provider: "OPENAI" as const,
      modelName: "gpt-4o",
      isEnabled: true,
      isDefaultCostEffective: false,
      inputTokenCostUsd: 0.0025,
      outputTokenCostUsd: 0.01,
    },
    {
      provider: "ANTHROPIC" as const,
      modelName: "claude-sonnet-4-20250514",
      isEnabled: true,
      isDefaultCostEffective: true,
      inputTokenCostUsd: 0.003,
      outputTokenCostUsd: 0.015,
    },
    {
      provider: "ANTHROPIC" as const,
      modelName: "claude-opus-4-20250514",
      isEnabled: true,
      isDefaultCostEffective: false,
      inputTokenCostUsd: 0.015,
      outputTokenCostUsd: 0.075,
    },
  ];

  for (const mt of modelTargets) {
    const record = await prisma.modelTarget.upsert({
      where: {
        provider_modelName: {
          provider: mt.provider,
          modelName: mt.modelName,
        },
      },
      update: {
        isEnabled: mt.isEnabled,
        isDefaultCostEffective: mt.isDefaultCostEffective,
        inputTokenCostUsd: mt.inputTokenCostUsd,
        outputTokenCostUsd: mt.outputTokenCostUsd,
      },
      create: {
        provider: mt.provider,
        modelName: mt.modelName,
        isEnabled: mt.isEnabled,
        isDefaultCostEffective: mt.isDefaultCostEffective,
        inputTokenCostUsd: mt.inputTokenCostUsd,
        outputTokenCostUsd: mt.outputTokenCostUsd,
      },
    });
    console.log(
      `ModelTarget ${record.provider}/${record.modelName} — ${record.id} (upserted)`
    );
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
