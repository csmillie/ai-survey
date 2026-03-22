import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    question: {
      findMany: vi.fn(),
    },
    variable: {
      findMany: vi.fn(),
    },
    matrixRow: {
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
  type: "OPEN_ENDED" as const,
  configJson: null,
  mode,
  threadKey,
  createdAt: new Date(),
  updatedAt: new Date(),
  code: null,
  helpText: null,
  constructKey: null,
  sourceSurvey: null,
  sourceVariable: null,
  benchmarkNotes: null,
  isBenchmarkAnchor: false,
  matrixRows: [] as Array<{
    id: string;
    questionId: string;
    rowKey: string;
    label: string;
    order: number;
    sourceVariable: string | null;
    constructKey: string | null;
    createdAt: Date;
  }>,
});

const makeMatrixRow = (questionId: string, rowKey: string, label: string, order: number) => ({
  id: `row-${questionId}-${rowKey}`,
  questionId,
  rowKey,
  label,
  order,
  sourceVariable: null,
  constructKey: null,
  createdAt: new Date(),
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

  it("includes questionType and config in payload for RANKED questions", async () => {
    const rankedQuestion = {
      ...makeQuestion("q-ranked", 0, "Rate {{brand}}"),
      type: "RANKED" as const,
      configJson: {
        scalePreset: "0-10",
        scaleMin: 0,
        scaleMax: 10,
        includeReasoning: true,
      },
    };

    vi.mocked(prisma.question.findMany).mockResolvedValue([rankedQuestion]);
    vi.mocked(prisma.variable.findMany).mockResolvedValue([]);

    const result = await allocateJobs({
      runId: RUN_ID,
      surveyId: SURVEY_ID,
      modelTargetIds: [MODEL_A],
    });

    expect(result.jobs[0].payloadJson).toMatchObject({
      questionType: "RANKED",
      questionConfig: {
        scalePreset: "0-10",
        scaleMin: 0,
        scaleMax: 10,
        includeReasoning: true,
      },
    });
  });

  it("sets questionType to OPEN_ENDED for standard questions", async () => {
    vi.mocked(prisma.question.findMany).mockResolvedValue([
      makeQuestion("q1", 0, "Tell me about {{brand}}"),
    ]);
    vi.mocked(prisma.variable.findMany).mockResolvedValue([]);

    const result = await allocateJobs({
      runId: RUN_ID,
      surveyId: SURVEY_ID,
      modelTargetIds: [MODEL_A],
    });

    expect(result.jobs[0].payloadJson).toMatchObject({
      questionType: "OPEN_ENDED",
    });
    expect(result.jobs[0].payloadJson).not.toHaveProperty("questionConfig");
  });

  it("expands MATRIX_LIKERT rows into separate jobs", async () => {
    const matrixQuestion = {
      ...makeQuestion("q-matrix", 1, "Rate institutions"),
      type: "MATRIX_LIKERT" as const,
      configJson: {
        type: "MATRIX_LIKERT",
        stem: "How much confidence?",
        options: [
          { label: "A great deal", value: "great_deal" },
          { label: "Hardly any", value: "hardly_any" },
        ],
      },
      matrixRows: [
        makeMatrixRow("q-matrix", "govt", "Government", 0),
        makeMatrixRow("q-matrix", "banks", "Banks", 1),
        makeMatrixRow("q-matrix", "media", "Media", 2),
      ],
    };

    vi.mocked(prisma.question.findMany).mockResolvedValue([matrixQuestion]);
    vi.mocked(prisma.variable.findMany).mockResolvedValue([]);

    const result = await allocateJobs({
      runId: RUN_ID,
      surveyId: SURVEY_ID,
      modelTargetIds: [MODEL_A, MODEL_B],
    });

    // 3 rows × 2 models = 6 jobs
    expect(result.totalJobs).toBe(6);

    // Each job has unique idempotency key including rowKey
    const keys = result.jobs.map((j) => j.idempotencyKey);
    expect(new Set(keys).size).toBe(6);

    // Check first model's jobs have correct row data
    const modelAJobs = result.jobs.filter((j) => j.modelTargetId === MODEL_A);
    expect(modelAJobs).toHaveLength(3);
    expect(modelAJobs[0].payloadJson.matrixRowKey).toBe("govt");
    expect(modelAJobs[0].payloadJson.matrixRowLabel).toBe("Government");
    expect(modelAJobs[1].payloadJson.matrixRowKey).toBe("banks");
    expect(modelAJobs[2].payloadJson.matrixRowKey).toBe("media");

    // Idempotency keys include rowKey
    expect(modelAJobs[0].idempotencyKey).toContain("govt");
    expect(modelAJobs[1].idempotencyKey).toContain("banks");
  });

  it("mixes matrix and non-matrix questions correctly", async () => {
    const normalQ = makeQuestion("q1", 0, "Open question");
    const matrixQ = {
      ...makeQuestion("q2", 1, "Rate items"),
      type: "MATRIX_LIKERT" as const,
      configJson: { type: "MATRIX_LIKERT", stem: "Rate:", options: [{ label: "A", value: "a" }] },
      matrixRows: [
        makeMatrixRow("q2", "row1", "Row 1", 0),
        makeMatrixRow("q2", "row2", "Row 2", 1),
      ],
    };

    vi.mocked(prisma.question.findMany).mockResolvedValue([normalQ, matrixQ]);
    vi.mocked(prisma.variable.findMany).mockResolvedValue([]);

    const result = await allocateJobs({
      runId: RUN_ID,
      surveyId: SURVEY_ID,
      modelTargetIds: [MODEL_A],
    });

    // 1 normal + 2 matrix rows = 3 jobs for 1 model
    expect(result.totalJobs).toBe(3);

    // First job is normal question (no matrixRowKey)
    expect(result.jobs[0].payloadJson.matrixRowKey).toBeUndefined();
    // Second and third are matrix rows
    expect(result.jobs[1].payloadJson.matrixRowKey).toBe("row1");
    expect(result.jobs[2].payloadJson.matrixRowKey).toBe("row2");
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
