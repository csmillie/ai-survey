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
    {
      provider: "GEMINI" as const,
      modelName: "gemini-2.5-flash",
      isEnabled: true,
      isDefaultCostEffective: true,
      inputTokenCostUsd: 0.0003,
      outputTokenCostUsd: 0.0025,
    },
    {
      provider: "GEMINI" as const,
      modelName: "gemini-2.5-pro",
      isEnabled: true,
      isDefaultCostEffective: false,
      inputTokenCostUsd: 0.00125,
      outputTokenCostUsd: 0.01,
    },
    {
      provider: "XAI" as const,
      modelName: "grok-3-mini",
      isEnabled: true,
      isDefaultCostEffective: true,
      inputTokenCostUsd: 0.0003,
      outputTokenCostUsd: 0.0005,
    },
    {
      provider: "XAI" as const,
      modelName: "grok-3",
      isEnabled: true,
      isDefaultCostEffective: false,
      inputTokenCostUsd: 0.003,
      outputTokenCostUsd: 0.015,
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

  // Disable gemini-2.0-flash (unreliable JSON output)
  await prisma.modelTarget.updateMany({
    where: { provider: "GEMINI", modelName: "gemini-2.0-flash" },
    data: { isEnabled: false },
  });

  // -------------------------------------------------------------------------
  // 3. Seed "GSS Lite Benchmark Demo" survey
  // -------------------------------------------------------------------------
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  if (adminUser) {
    const benchmarkSurvey = await prisma.survey.upsert({
      where: {
        // Use a deterministic composite key via the title + owner lookup.
        // Since there is no unique constraint on title, we use id-based upsert
        // with a stable UUID derived from the survey name.
        id: "00000000-0000-4000-a000-benchmark-gss",
      },
      update: {
        title: "GSS Lite Benchmark Demo",
        description:
          "Demonstration survey with one example of each benchmark question type, " +
          "drawn from GSS and WVS instruments.",
        isBenchmarkInstrument: true,
        benchmarkSource: "GSS/WVS Composite",
      },
      create: {
        id: "00000000-0000-4000-a000-benchmark-gss",
        ownerId: adminUser.id,
        title: "GSS Lite Benchmark Demo",
        description:
          "Demonstration survey with one example of each benchmark question type, " +
          "drawn from GSS and WVS instruments.",
        isBenchmarkInstrument: true,
        benchmarkSource: "GSS/WVS Composite",
      },
    });

    const surveyId = benchmarkSurvey.id;
    console.log(`Benchmark survey "${benchmarkSurvey.title}" — ${surveyId} (upserted)`);

    // --- Q1: SINGLE_SELECT — General happiness ---
    const q1Id = "00000000-0000-4000-a001-benchmark-gss";
    await prisma.question.upsert({
      where: { id: q1Id },
      update: {
        title: "General happiness",
        promptTemplate:
          "Taken all together, how would you say things are these days — " +
          "would you say that you are very happy, pretty happy, or not too happy?",
        type: "SINGLE_SELECT",
        order: 1,
        code: "HAPPY",
        sourceSurvey: "GSS",
        sourceVariable: "HAPPY",
        configJson: {
          type: "SINGLE_SELECT",
          options: [
            { label: "Very happy", value: "very_happy", numericValue: 3 },
            { label: "Pretty happy", value: "pretty_happy", numericValue: 2 },
            { label: "Not too happy", value: "not_too_happy", numericValue: 1 },
          ],
          allowDontKnow: false,
        },
      },
      create: {
        id: q1Id,
        surveyId,
        title: "General happiness",
        promptTemplate:
          "Taken all together, how would you say things are these days — " +
          "would you say that you are very happy, pretty happy, or not too happy?",
        type: "SINGLE_SELECT",
        order: 1,
        code: "HAPPY",
        sourceSurvey: "GSS",
        sourceVariable: "HAPPY",
        configJson: {
          type: "SINGLE_SELECT",
          options: [
            { label: "Very happy", value: "very_happy", numericValue: 3 },
            { label: "Pretty happy", value: "pretty_happy", numericValue: 2 },
            { label: "Not too happy", value: "not_too_happy", numericValue: 1 },
          ],
          allowDontKnow: false,
        },
      },
    });
    console.log("  Q1 SINGLE_SELECT — HAPPY (upserted)");

    // --- Q2: BINARY — Social support ---
    const q2Id = "00000000-0000-4000-a002-benchmark-gss";
    await prisma.question.upsert({
      where: { id: q2Id },
      update: {
        title: "Social support: Do you have someone you can count on?",
        promptTemplate:
          "If you were in trouble, do you have a relative or friend you can count on " +
          "to help you whenever you need them, or not?",
        type: "BINARY",
        order: 2,
        code: "SUPPORT1",
        sourceSurvey: "GSS",
        configJson: {
          type: "BINARY",
          options: [
            { label: "Yes", value: "yes", numericValue: 1 },
            { label: "No", value: "no", numericValue: 0 },
          ],
        },
      },
      create: {
        id: q2Id,
        surveyId,
        title: "Social support: Do you have someone you can count on?",
        promptTemplate:
          "If you were in trouble, do you have a relative or friend you can count on " +
          "to help you whenever you need them, or not?",
        type: "BINARY",
        order: 2,
        code: "SUPPORT1",
        sourceSurvey: "GSS",
        configJson: {
          type: "BINARY",
          options: [
            { label: "Yes", value: "yes", numericValue: 1 },
            { label: "No", value: "no", numericValue: 0 },
          ],
        },
      },
    });
    console.log("  Q2 BINARY — SUPPORT1 (upserted)");

    // --- Q3: FORCED_CHOICE — Social trust ---
    const q3Id = "00000000-0000-4000-a003-benchmark-gss";
    await prisma.question.upsert({
      where: { id: q3Id },
      update: {
        title: "Social trust",
        promptTemplate:
          "Generally speaking, would you say that most people can be trusted " +
          "or that you can't be too careful in dealing with people?",
        type: "FORCED_CHOICE",
        order: 3,
        code: "TRUST",
        sourceSurvey: "GSS",
        sourceVariable: "TRUST",
        constructKey: "social_trust",
        configJson: {
          type: "FORCED_CHOICE",
          options: [
            { label: "Most people can be trusted", value: "trust", numericValue: 1 },
            { label: "You can't be too careful", value: "careful", numericValue: 0 },
          ],
          poleALabel: "Trusting",
          poleBLabel: "Cautious",
        },
      },
      create: {
        id: q3Id,
        surveyId,
        title: "Social trust",
        promptTemplate:
          "Generally speaking, would you say that most people can be trusted " +
          "or that you can't be too careful in dealing with people?",
        type: "FORCED_CHOICE",
        order: 3,
        code: "TRUST",
        sourceSurvey: "GSS",
        sourceVariable: "TRUST",
        constructKey: "social_trust",
        configJson: {
          type: "FORCED_CHOICE",
          options: [
            { label: "Most people can be trusted", value: "trust", numericValue: 1 },
            { label: "You can't be too careful", value: "careful", numericValue: 0 },
          ],
          poleALabel: "Trusting",
          poleBLabel: "Cautious",
        },
      },
    });
    console.log("  Q3 FORCED_CHOICE — TRUST (upserted)");

    // --- Q4: LIKERT — Working mothers ---
    const q4Id = "00000000-0000-4000-a004-benchmark-gss";
    await prisma.question.upsert({
      where: { id: q4Id },
      update: {
        title: "Working mothers",
        promptTemplate:
          "A working mother can establish just as warm and secure a relationship " +
          "with her children as a mother who does not work. " +
          "Do you strongly agree, agree, neither agree nor disagree, disagree, " +
          "or strongly disagree?",
        type: "LIKERT",
        order: 4,
        code: "FECHLD",
        sourceSurvey: "GSS",
        configJson: {
          type: "LIKERT",
          points: 5,
          options: [
            { label: "Strongly agree", value: "strongly_agree", numericValue: 5 },
            { label: "Agree", value: "agree", numericValue: 4 },
            { label: "Neither agree nor disagree", value: "neither", numericValue: 3 },
            { label: "Disagree", value: "disagree", numericValue: 2 },
            { label: "Strongly disagree", value: "strongly_disagree", numericValue: 1 },
          ],
        },
      },
      create: {
        id: q4Id,
        surveyId,
        title: "Working mothers",
        promptTemplate:
          "A working mother can establish just as warm and secure a relationship " +
          "with her children as a mother who does not work. " +
          "Do you strongly agree, agree, neither agree nor disagree, disagree, " +
          "or strongly disagree?",
        type: "LIKERT",
        order: 4,
        code: "FECHLD",
        sourceSurvey: "GSS",
        configJson: {
          type: "LIKERT",
          points: 5,
          options: [
            { label: "Strongly agree", value: "strongly_agree", numericValue: 5 },
            { label: "Agree", value: "agree", numericValue: 4 },
            { label: "Neither agree nor disagree", value: "neither", numericValue: 3 },
            { label: "Disagree", value: "disagree", numericValue: 2 },
            { label: "Strongly disagree", value: "strongly_disagree", numericValue: 1 },
          ],
        },
      },
    });
    console.log("  Q4 LIKERT — FECHLD (upserted)");

    // --- Q5: NUMERIC_SCALE — Life satisfaction ---
    const q5Id = "00000000-0000-4000-a005-benchmark-gss";
    await prisma.question.upsert({
      where: { id: q5Id },
      update: {
        title: "Life satisfaction",
        promptTemplate:
          "All things considered, how satisfied are you with your life as a whole " +
          "these days? Please respond with a number from 0 to 10, where 0 means " +
          "completely dissatisfied and 10 means completely satisfied.",
        type: "NUMERIC_SCALE",
        order: 5,
        code: "LIFESAT",
        sourceSurvey: "WVS",
        configJson: {
          type: "NUMERIC_SCALE",
          min: 0,
          max: 10,
          minLabel: "Completely dissatisfied",
          maxLabel: "Completely satisfied",
        },
      },
      create: {
        id: q5Id,
        surveyId,
        title: "Life satisfaction",
        promptTemplate:
          "All things considered, how satisfied are you with your life as a whole " +
          "these days? Please respond with a number from 0 to 10, where 0 means " +
          "completely dissatisfied and 10 means completely satisfied.",
        type: "NUMERIC_SCALE",
        order: 5,
        code: "LIFESAT",
        sourceSurvey: "WVS",
        configJson: {
          type: "NUMERIC_SCALE",
          min: 0,
          max: 10,
          minLabel: "Completely dissatisfied",
          maxLabel: "Completely satisfied",
        },
      },
    });
    console.log("  Q5 NUMERIC_SCALE — LIFESAT (upserted)");

    // --- Q6: MATRIX_LIKERT — Confidence in institutions ---
    const q6Id = "00000000-0000-4000-a006-benchmark-gss";
    await prisma.question.upsert({
      where: { id: q6Id },
      update: {
        title: "Confidence in institutions",
        promptTemplate:
          "How much confidence do you have in the following institution: {{institution}}? " +
          "Would you say a great deal, only some, or hardly any?",
        type: "MATRIX_LIKERT",
        order: 6,
        code: "CONFI",
        sourceSurvey: "GSS",
        configJson: {
          type: "MATRIX_LIKERT",
          stem:
            "How much confidence do you have in the following institutions?",
          options: [
            { label: "A great deal", value: "great_deal", numericValue: 3 },
            { label: "Only some", value: "only_some", numericValue: 2 },
            { label: "Hardly any", value: "hardly_any", numericValue: 1 },
          ],
        },
      },
      create: {
        id: q6Id,
        surveyId,
        title: "Confidence in institutions",
        promptTemplate:
          "How much confidence do you have in the following institution: {{institution}}? " +
          "Would you say a great deal, only some, or hardly any?",
        type: "MATRIX_LIKERT",
        order: 6,
        code: "CONFI",
        sourceSurvey: "GSS",
        configJson: {
          type: "MATRIX_LIKERT",
          stem:
            "How much confidence do you have in the following institutions?",
          options: [
            { label: "A great deal", value: "great_deal", numericValue: 3 },
            { label: "Only some", value: "only_some", numericValue: 2 },
            { label: "Hardly any", value: "hardly_any", numericValue: 1 },
          ],
        },
      },
    });
    console.log("  Q6 MATRIX_LIKERT — CONFI (upserted)");

    // --- Matrix rows for Q6 ---
    const matrixRows = [
      { rowKey: "government", label: "Government", order: 1, sourceVariable: "CONFED" },
      { rowKey: "banks", label: "Banks", order: 2, sourceVariable: "CONBUS" },
      { rowKey: "media", label: "Media", order: 3, sourceVariable: "CONPRESS" },
      { rowKey: "courts", label: "Courts", order: 4, sourceVariable: "CONJUDGE" },
      { rowKey: "education", label: "Education", order: 5, sourceVariable: "CONEDUC" },
    ];

    for (const row of matrixRows) {
      await prisma.matrixRow.upsert({
        where: {
          questionId_rowKey: { questionId: q6Id, rowKey: row.rowKey },
        },
        update: {
          label: row.label,
          order: row.order,
          sourceVariable: row.sourceVariable,
        },
        create: {
          questionId: q6Id,
          rowKey: row.rowKey,
          label: row.label,
          order: row.order,
          sourceVariable: row.sourceVariable,
        },
      });
    }
    console.log("  Matrix rows for CONFI (5 rows upserted)");
  } else {
    console.warn(
      "No admin user found — skipping benchmark survey seed. " +
      "Ensure ADMIN_EMAILS is set in .env."
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
