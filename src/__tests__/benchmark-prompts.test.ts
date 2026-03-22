import { describe, it, expect } from "vitest";
import {
  buildBenchmarkSystemPrompt,
  buildSingleSelectEnforcement,
  buildBinaryEnforcement,
  buildForcedChoiceEnforcement,
  buildLikertEnforcement,
  buildNumericScaleEnforcement,
  buildMatrixLikertRowEnforcement,
  buildBenchmarkEnforcementBlock,
} from "@/lib/benchmark-prompts";
import type {
  SingleSelectConfig,
  BinaryConfig,
  ForcedChoiceConfig,
  LikertConfig,
  NumericScaleConfig,
  MatrixLikertConfig,
} from "@/lib/benchmark-types";

describe("buildBenchmarkSystemPrompt", () => {
  it("returns a survey respondent system prompt", () => {
    const prompt = buildBenchmarkSystemPrompt();
    expect(prompt).toContain("survey respondent");
    expect(prompt).toContain("JSON");
  });
});

describe("buildSingleSelectEnforcement", () => {
  const config: SingleSelectConfig = {
    type: "SINGLE_SELECT",
    options: [
      { label: "Very happy", value: "very_happy", numericValue: 3 },
      { label: "Pretty happy", value: "pretty_happy", numericValue: 2 },
      { label: "Not too happy", value: "not_happy", numericValue: 1 },
    ],
  };

  it("lists all options", () => {
    const block = buildSingleSelectEnforcement(config);
    expect(block).toContain("very_happy");
    expect(block).toContain("Pretty happy");
    expect(block).toContain("not_happy");
  });

  it("includes selectedValue in JSON schema", () => {
    const block = buildSingleSelectEnforcement(config);
    expect(block).toContain('"selectedValue"');
    expect(block).toContain('"confidence"');
  });

  it("includes dont_know when allowDontKnow is true", () => {
    const withDk: SingleSelectConfig = { ...config, allowDontKnow: true };
    const block = buildSingleSelectEnforcement(withDk);
    expect(block).toContain("dont_know");
  });

  it("omits dont_know by default", () => {
    const block = buildSingleSelectEnforcement(config);
    expect(block).not.toContain("dont_know");
  });
});

describe("buildBinaryEnforcement", () => {
  const config: BinaryConfig = {
    type: "BINARY",
    options: [
      { label: "Yes", value: "yes", numericValue: 1 },
      { label: "No", value: "no", numericValue: 0 },
    ],
  };

  it("lists both options", () => {
    const block = buildBinaryEnforcement(config);
    expect(block).toContain("yes");
    expect(block).toContain("no");
  });

  it("includes JSON schema", () => {
    const block = buildBinaryEnforcement(config);
    expect(block).toContain('"selectedValue"');
  });
});

describe("buildForcedChoiceEnforcement", () => {
  const config: ForcedChoiceConfig = {
    type: "FORCED_CHOICE",
    options: [
      { label: "Most people can be trusted", value: "trust" },
      { label: "Can't be too careful", value: "careful" },
    ],
    poleALabel: "Trusting",
    poleBLabel: "Cautious",
  };

  it("lists both options", () => {
    const block = buildForcedChoiceEnforcement(config);
    expect(block).toContain("trust");
    expect(block).toContain("careful");
  });

  it("includes pole labels", () => {
    const block = buildForcedChoiceEnforcement(config);
    expect(block).toContain("Trusting");
    expect(block).toContain("Cautious");
  });

  it("works without pole labels", () => {
    const noPoles: ForcedChoiceConfig = {
      type: "FORCED_CHOICE",
      options: config.options,
    };
    const block = buildForcedChoiceEnforcement(noPoles);
    expect(block).toContain("trust");
    expect(block).not.toContain("Pole A");
  });
});

describe("buildLikertEnforcement", () => {
  const config: LikertConfig = {
    type: "LIKERT",
    points: 5,
    options: [
      { label: "Strongly agree", value: "5", numericValue: 5 },
      { label: "Agree", value: "4", numericValue: 4 },
      { label: "Neither", value: "3", numericValue: 3 },
      { label: "Disagree", value: "2", numericValue: 2 },
      { label: "Strongly disagree", value: "1", numericValue: 1 },
    ],
  };

  it("includes scale point count", () => {
    const block = buildLikertEnforcement(config);
    expect(block).toContain("5-point");
  });

  it("lists all options", () => {
    const block = buildLikertEnforcement(config);
    expect(block).toContain("Strongly agree");
    expect(block).toContain("Strongly disagree");
  });
});

describe("buildNumericScaleEnforcement", () => {
  const config: NumericScaleConfig = {
    type: "NUMERIC_SCALE",
    min: 0,
    max: 10,
    minLabel: "Completely dissatisfied",
    maxLabel: "Completely satisfied",
  };

  it("includes min and max values", () => {
    const block = buildNumericScaleEnforcement(config);
    expect(block).toContain("0");
    expect(block).toContain("10");
  });

  it("includes anchor labels", () => {
    const block = buildNumericScaleEnforcement(config);
    expect(block).toContain("Completely dissatisfied");
    expect(block).toContain("Completely satisfied");
  });

  it("includes score in JSON schema", () => {
    const block = buildNumericScaleEnforcement(config);
    expect(block).toContain('"score"');
    expect(block).toContain('"confidence"');
  });

  it("works without anchor labels", () => {
    const noAnchors: NumericScaleConfig = {
      type: "NUMERIC_SCALE",
      min: 1,
      max: 7,
    };
    const block = buildNumericScaleEnforcement(noAnchors);
    expect(block).toContain("1");
    expect(block).toContain("7");
    expect(block).not.toContain("Anchors");
  });
});

describe("buildMatrixLikertRowEnforcement", () => {
  const config: MatrixLikertConfig = {
    type: "MATRIX_LIKERT",
    stem: "How much confidence do you have in the following institutions?",
    options: [
      { label: "A great deal", value: "great_deal", numericValue: 3 },
      { label: "Only some", value: "only_some", numericValue: 2 },
      { label: "Hardly any", value: "hardly_any", numericValue: 1 },
    ],
  };

  it("includes the stem text", () => {
    const block = buildMatrixLikertRowEnforcement(config, {
      rowKey: "government",
      label: "The Federal Government",
    });
    expect(block).toContain("confidence do you have");
  });

  it("includes the row label", () => {
    const block = buildMatrixLikertRowEnforcement(config, {
      rowKey: "government",
      label: "The Federal Government",
    });
    expect(block).toContain("The Federal Government");
  });

  it("lists all column options", () => {
    const block = buildMatrixLikertRowEnforcement(config, {
      rowKey: "banks",
      label: "Banks",
    });
    expect(block).toContain("great_deal");
    expect(block).toContain("Only some");
    expect(block).toContain("hardly_any");
  });
});

describe("buildBenchmarkEnforcementBlock dispatcher", () => {
  it("dispatches SINGLE_SELECT correctly", () => {
    const config: SingleSelectConfig = {
      type: "SINGLE_SELECT",
      options: [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ],
    };
    const block = buildBenchmarkEnforcementBlock(config);
    expect(block).toContain('"selectedValue"');
  });

  it("dispatches NUMERIC_SCALE correctly", () => {
    const config: NumericScaleConfig = {
      type: "NUMERIC_SCALE",
      min: 0,
      max: 10,
    };
    const block = buildBenchmarkEnforcementBlock(config);
    expect(block).toContain('"score"');
  });

  it("throws when MATRIX_LIKERT called without matrixRow", () => {
    const config: MatrixLikertConfig = {
      type: "MATRIX_LIKERT",
      stem: "test",
      options: [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ],
    };
    expect(() => buildBenchmarkEnforcementBlock(config)).toThrow(
      "matrixRow is required"
    );
  });

  it("dispatches MATRIX_LIKERT with matrixRow", () => {
    const config: MatrixLikertConfig = {
      type: "MATRIX_LIKERT",
      stem: "Rate these",
      options: [
        { label: "High", value: "high" },
        { label: "Low", value: "low" },
      ],
    };
    const block = buildBenchmarkEnforcementBlock(config, {
      rowKey: "item1",
      label: "Item 1",
    });
    expect(block).toContain("Item 1");
    expect(block).toContain("Rate these");
  });
});
