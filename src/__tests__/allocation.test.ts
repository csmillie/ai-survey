import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    question: {
      findMany: vi.fn(),
    },
    variable: {
      findMany: vi.fn(),
    },
  },
}));

import { allocateJobs } from "@/lib/allocation";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SURVEY_ID = "survey-1";
const RUN_ID = "run-1";
const MODEL_A = "model-a";
const MODEL_B = "model-b";

const makeQuestion = (
  id: string,
  order: number,
  template: string,
  mode: "STATELESS" | "THREADED" = "STATELESS",
  threadKey: string | null = null
) => ({
  id,
  surveyId: SURVEY_ID,
  order,
  title: `Question ${id}`,
  promptTemplate: template,
  mode,
  threadKey,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeVariable = (key: string, defaultValue: string | null) => ({
  id: `var-${key}`,
  surveyId: SURVEY_ID,
  key,
  label: key,
  defaultValue,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupMocks(
  questions: ReturnType<typeof makeQuestion>[],
  variables: ReturnType<typeof makeVariable>[] = []
) {
  vi.mocked(prisma.question.findMany).mockResolvedValue(questions);
  vi.mocked(prisma.variable.findMany).mockResolvedValue(variables);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("allocateJobs", () => {
  it("produces deterministic ordering (models outer, questions inner)", async () => {
    const questions = [
      makeQuestion("q1", 1, "Prompt 1"),
      makeQuestion("q2", 2, "Prompt 2"),
      makeQuestion("q3", 3, "Prompt 3"),
    ];
    setupMocks(questions);

    const result = await allocateJobs({
      runId: RUN_ID,
      surveyId: SURVEY_ID,
      modelTargetIds: [MODEL_A, MODEL_B],
    });

    expect(result.totalJobs).toBe(6);

    // First 3 jobs: MODEL_A x [q1, q2, q3]
    expect(result.jobs[0].modelTargetId).toBe(MODEL_A);
    expect(result.jobs[0].questionId).toBe("q1");
    expect(result.jobs[1].modelTargetId).toBe(MODEL_A);
    expect(result.jobs[1].questionId).toBe("q2");
    expect(result.jobs[2].modelTargetId).toBe(MODEL_A);
    expect(result.jobs[2].questionId).toBe("q3");

    // Next 3 jobs: MODEL_B x [q1, q2, q3]
    expect(result.jobs[3].modelTargetId).toBe(MODEL_B);
    expect(result.jobs[3].questionId).toBe("q1");
    expect(result.jobs[4].modelTargetId).toBe(MODEL_B);
    expect(result.jobs[4].questionId).toBe("q2");
    expect(result.jobs[5].modelTargetId).toBe(MODEL_B);
    expect(result.jobs[5].questionId).toBe("q3");
  });

  it("generates unique idempotency keys", async () => {
    const questions = [
      makeQuestion("q1", 1, "Prompt 1"),
      makeQuestion("q2", 2, "Prompt 2"),
      makeQuestion("q3", 3, "Prompt 3"),
    ];
    setupMocks(questions);

    const result = await allocateJobs({
      runId: RUN_ID,
      surveyId: SURVEY_ID,
      modelTargetIds: [MODEL_A, MODEL_B],
    });

    const keys = result.jobs.map((j) => j.idempotencyKey);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it("produces stable idempotency keys across identical invocations", async () => {
    const questions = [
      makeQuestion("q1", 1, "Prompt 1"),
      makeQuestion("q2", 2, "Prompt 2"),
    ];
    setupMocks(questions);

    const params = {
      runId: RUN_ID,
      surveyId: SURVEY_ID,
      modelTargetIds: [MODEL_A],
    };

    const result1 = await allocateJobs(params);
    const result2 = await allocateJobs(params);

    const keys1 = result1.jobs.map((j) => j.idempotencyKey);
    const keys2 = result2.jobs.map((j) => j.idempotencyKey);
    expect(keys1).toEqual(keys2);
  });

  it("assigns unique thread keys for STATELESS questions and shared thread keys for THREADED questions", async () => {
    const questions = [
      makeQuestion("q1", 1, "Prompt 1", "STATELESS"),
      makeQuestion("q2", 2, "Prompt 2", "THREADED", "shared-thread"),
      makeQuestion("q3", 3, "Prompt 3", "THREADED", "shared-thread"),
    ];
    setupMocks(questions);

    const result = await allocateJobs({
      runId: RUN_ID,
      surveyId: SURVEY_ID,
      modelTargetIds: [MODEL_A, MODEL_B],
    });

    // STATELESS q1: thread key is unique per model+question
    const modelAQ1 = result.jobs.find(
      (j) => j.modelTargetId === MODEL_A && j.questionId === "q1"
    )!;
    const modelBQ1 = result.jobs.find(
      (j) => j.modelTargetId === MODEL_B && j.questionId === "q1"
    )!;
    expect(modelAQ1.threadKey).not.toBe(modelBQ1.threadKey);

    // THREADED q2 and q3 with same threadKey share a thread key per model
    const modelAQ2 = result.jobs.find(
      (j) => j.modelTargetId === MODEL_A && j.questionId === "q2"
    )!;
    const modelAQ3 = result.jobs.find(
      (j) => j.modelTargetId === MODEL_A && j.questionId === "q3"
    )!;
    expect(modelAQ2.threadKey).toBe(modelAQ3.threadKey);

    // But different models get different thread keys even for same threadKey
    const modelBQ2 = result.jobs.find(
      (j) => j.modelTargetId === MODEL_B && j.questionId === "q2"
    )!;
    expect(modelAQ2.threadKey).not.toBe(modelBQ2.threadKey);
  });

  it("resolves variables in prompt templates", async () => {
    const questions = [
      makeQuestion("q1", 1, "Tell me about {{topic}} in {{language}}"),
    ];
    const variables = [
      makeVariable("topic", "AI safety"),
      makeVariable("language", null),
    ];
    setupMocks(questions, variables);

    const result = await allocateJobs({
      runId: RUN_ID,
      surveyId: SURVEY_ID,
      modelTargetIds: [MODEL_A],
      variableOverrides: { language: "English" },
    });

    const payload = result.jobs[0].payloadJson as {
      renderedPrompt: string;
      variableValues: Record<string, string>;
    };

    // "topic" resolved from default, "language" resolved from override
    expect(payload.renderedPrompt).toBe("Tell me about AI safety in English");
    expect(payload.variableValues.topic).toBe("AI safety");
    expect(payload.variableValues.language).toBe("English");
  });
});
