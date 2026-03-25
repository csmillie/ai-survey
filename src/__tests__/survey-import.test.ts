import { describe, it, expect } from "vitest";
import {
  mapImportToSurvey,
  importSurveyJsonSchema,
  type ImportSurveyJson,
} from "@/lib/survey-import";

// ---------------------------------------------------------------------------
// Minimal valid survey fixture
// ---------------------------------------------------------------------------

function makeMinimalSurvey(overrides?: Partial<ImportSurveyJson>): ImportSurveyJson {
  return {
    title: "Test Survey",
    questions: [
      {
        id: "Q1",
        order: 1,
        question_type: "categorical_single_select",
        text: "How happy are you?",
        options: [
          { value: "happy", label: "Happy", score: 2 },
          { value: "sad", label: "Sad", score: 1 },
        ],
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Schema Validation
// ---------------------------------------------------------------------------

describe("importSurveyJsonSchema", () => {
  it("accepts valid minimal survey", () => {
    const result = importSurveyJsonSchema.safeParse(makeMinimalSurvey());
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = importSurveyJsonSchema.safeParse({ questions: [{ id: "Q1", order: 1, question_type: "categorical_single_select", text: "Test" }] });
    expect(result.success).toBe(false);
  });

  it("rejects empty questions array", () => {
    const result = importSurveyJsonSchema.safeParse({ title: "Test", questions: [] });
    expect(result.success).toBe(false);
  });

  it("accepts full survey with all optional fields", () => {
    const result = importSurveyJsonSchema.safeParse(makeMinimalSurvey({
      survey_id: "test_v1",
      version: "1.0.0",
      language: "en",
      benchmark_sources: ["GSS", "WVS"],
      indices: [{ id: "idx1", name: "Well-Being", question_ids: ["Q1"], method: "normalized_mean" }],
    }));
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Type Mapping: categorical_single_select -> SINGLE_SELECT
// ---------------------------------------------------------------------------

describe("mapImportToSurvey — SINGLE_SELECT", () => {
  it("maps categorical_single_select to SINGLE_SELECT with numericValue", () => {
    const result = mapImportToSurvey(makeMinimalSurvey());
    expect(result.questions).toHaveLength(1);

    const q = result.questions[0];
    expect(q.type).toBe("SINGLE_SELECT");
    expect(q.promptTemplate).toBe("How happy are you?");

    const config = q.configJson as { type: string; options: Array<{ value: string; numericValue: number }> };
    expect(config.type).toBe("SINGLE_SELECT");
    expect(config.options).toHaveLength(2);
    expect(config.options[0].value).toBe("happy");
    expect(config.options[0].numericValue).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Type Mapping: boolean_yes_no -> BINARY
// ---------------------------------------------------------------------------

describe("mapImportToSurvey — BINARY", () => {
  it("converts boolean values to string yes/no", () => {
    const survey = makeMinimalSurvey({
      questions: [{
        id: "Q1",
        order: 1,
        question_type: "boolean_yes_no",
        text: "Did you experience stress?",
        options: [
          { value: true, label: "Yes", score: 0 },
          { value: false, label: "No", score: 1 },
        ],
      }],
    });

    const result = mapImportToSurvey(survey);
    const q = result.questions[0];
    expect(q.type).toBe("BINARY");

    const config = q.configJson as { type: string; options: Array<{ value: string; numericValue: number }> };
    expect(config.options[0].value).toBe("yes");
    expect(config.options[0].numericValue).toBe(0);
    expect(config.options[1].value).toBe("no");
    expect(config.options[1].numericValue).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Type Mapping: forced_choice -> FORCED_CHOICE
// ---------------------------------------------------------------------------

describe("mapImportToSurvey — FORCED_CHOICE", () => {
  it("maps forced_choice with two options", () => {
    const survey = makeMinimalSurvey({
      questions: [{
        id: "Q7",
        order: 7,
        question_type: "forced_choice",
        text: "Can most people be trusted?",
        options: [
          { value: "trust", label: "Most people can be trusted", score: 1 },
          { value: "careful", label: "Can't be too careful", score: 0 },
        ],
      }],
    });

    const result = mapImportToSurvey(survey);
    const q = result.questions[0];
    expect(q.type).toBe("FORCED_CHOICE");

    const config = q.configJson as { type: string; options: Array<{ value: string; numericValue: number }> };
    expect(config.type).toBe("FORCED_CHOICE");
    expect(config.options).toHaveLength(2);
    expect(config.options[0].numericValue).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Type Mapping: likert_scale -> LIKERT
// ---------------------------------------------------------------------------

describe("mapImportToSurvey — LIKERT", () => {
  it("expands scale.labels into options with auto numericValue", () => {
    const survey = makeMinimalSurvey({
      questions: [{
        id: "Q22",
        order: 22,
        question_type: "likert_scale",
        text: "A working mother can establish just as warm a relationship...",
        scale: {
          min: 1,
          max: 4,
          labels: ["Strongly disagree", "Disagree", "Agree", "Strongly agree"],
        },
      }],
    });

    const result = mapImportToSurvey(survey);
    const q = result.questions[0];
    expect(q.type).toBe("LIKERT");

    const config = q.configJson as { type: string; points: number; options: Array<{ label: string; value: string; numericValue: number }> };
    expect(config.points).toBe(4);
    expect(config.options).toHaveLength(4);
    expect(config.options[0].label).toBe("Strongly disagree");
    expect(config.options[0].value).toBe("strongly_disagree");
    expect(config.options[0].numericValue).toBe(1);
    expect(config.options[3].label).toBe("Strongly agree");
    expect(config.options[3].numericValue).toBe(4);
  });

  it("throws on missing scale.labels", () => {
    const survey = makeMinimalSurvey({
      questions: [{
        id: "Q1",
        order: 1,
        question_type: "likert_scale",
        text: "Test",
        scale: { min: 1, max: 5 },
      }],
    });

    expect(() => mapImportToSurvey(survey)).toThrow("missing scale.labels");
  });
});

// ---------------------------------------------------------------------------
// Type Mapping: integer_scale -> NUMERIC_SCALE
// ---------------------------------------------------------------------------

describe("mapImportToSurvey — NUMERIC_SCALE", () => {
  it("maps scale min/max and labels", () => {
    const survey = makeMinimalSurvey({
      questions: [{
        id: "Q2",
        order: 2,
        question_type: "integer_scale",
        text: "How satisfied are you with your life?",
        scale: {
          min: 1,
          max: 10,
          min_label: "Dissatisfied",
          max_label: "Satisfied",
        },
      }],
    });

    const result = mapImportToSurvey(survey);
    const q = result.questions[0];
    expect(q.type).toBe("NUMERIC_SCALE");

    const config = q.configJson as { type: string; min: number; max: number; minLabel: string; maxLabel: string };
    expect(config.min).toBe(1);
    expect(config.max).toBe(10);
    expect(config.minLabel).toBe("Dissatisfied");
    expect(config.maxLabel).toBe("Satisfied");
  });

  it("throws on missing scale", () => {
    const survey = makeMinimalSurvey({
      questions: [{
        id: "Q1",
        order: 1,
        question_type: "integer_scale",
        text: "Test",
      }],
    });

    expect(() => mapImportToSurvey(survey)).toThrow("missing scale");
  });
});

// ---------------------------------------------------------------------------
// Metadata Mapping
// ---------------------------------------------------------------------------

describe("mapImportToSurvey — metadata", () => {
  it("maps source, source_variable, section, tags to question fields", () => {
    const survey = makeMinimalSurvey({
      questions: [{
        id: "Q1",
        order: 1,
        section: "well_being",
        source: "GSS",
        source_variable: "HAPPY",
        question_type: "categorical_single_select",
        text: "How happy are you?",
        options: [
          { value: "happy", label: "Happy", score: 2 },
          { value: "sad", label: "Sad", score: 1 },
        ],
        tags: ["happiness", "anchor"],
        benchmark: {
          geography: "US",
          distribution: { happy: 0.55, sad: 0.45 },
        },
      }],
    });

    const result = mapImportToSurvey(survey);
    const q = result.questions[0];
    expect(q.code).toBe("Q1");
    expect(q.constructKey).toBe("well_being");
    expect(q.sourceSurvey).toBe("GSS");
    expect(q.sourceVariable).toBe("HAPPY");
    expect(q.isBenchmarkAnchor).toBe(true);
    expect(q.benchmarkNotes).toContain("US");
    expect(q.benchmarkNotes).toContain("0.55");
  });

  it("sets isBenchmarkAnchor false when no anchor tag", () => {
    const result = mapImportToSurvey(makeMinimalSurvey());
    expect(result.questions[0].isBenchmarkAnchor).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Survey-level Mapping
// ---------------------------------------------------------------------------

describe("mapImportToSurvey — survey level", () => {
  it("maps title, description, benchmark metadata", () => {
    const survey = makeMinimalSurvey({
      title: "GSS-Lite Benchmark",
      description: "A benchmark survey.",
      version: "1.0.0",
      benchmark_sources: ["GSS", "WVS"],
      default_mode: "deterministic",
    });

    const result = mapImportToSurvey(survey);
    expect(result.title).toBe("GSS-Lite Benchmark");
    expect(result.description).toContain("A benchmark survey.");
    expect(result.isBenchmarkInstrument).toBe(true);
    expect(result.benchmarkSource).toBe("GSS, WVS");
    expect(result.benchmarkVersion).toBe("1.0.0");
    expect(result.executionMode).toBe("deterministic");
  });

  it("appends indices to description", () => {
    const survey = makeMinimalSurvey({
      indices: [
        { id: "idx1", name: "Well-Being Index", question_ids: ["Q1"], method: "normalized_mean" },
      ],
    });

    const result = mapImportToSurvey(survey);
    expect(result.description).toContain("Well-Being Index");
    expect(result.description).toContain("normalized_mean");
  });
});

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

describe("mapImportToSurvey — errors", () => {
  it("throws on unknown question type", () => {
    const survey = makeMinimalSurvey({
      questions: [{
        id: "Q1",
        order: 1,
        question_type: "matrix_rating",
        text: "Test",
      }],
    });

    expect(() => mapImportToSurvey(survey)).toThrow('Unknown question type "matrix_rating"');
  });
});

// ---------------------------------------------------------------------------
// Title truncation
// ---------------------------------------------------------------------------

describe("mapImportToSurvey — title generation", () => {
  it("truncates long question text to 60 chars for title", () => {
    const longText = "This is a very long question text that should be truncated to sixty characters for the title field";
    const survey = makeMinimalSurvey({
      questions: [{
        id: "Q1",
        order: 1,
        question_type: "categorical_single_select",
        text: longText,
        options: [
          { value: "a", label: "A", score: 1 },
          { value: "b", label: "B", score: 0 },
        ],
      }],
    });

    const result = mapImportToSurvey(survey);
    expect(result.questions[0].title.length).toBeLessThanOrEqual(60);
    expect(result.questions[0].promptTemplate).toBe(longText);
  });
});
