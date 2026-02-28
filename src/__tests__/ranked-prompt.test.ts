import { describe, it, expect } from "vitest";
import {
  buildRankedSystemPrompt,
  buildRankedEnforcementBlock,
  clampScore,
} from "@/lib/ranked-prompt";

describe("buildRankedSystemPrompt", () => {
  it("returns the evaluator system prompt", () => {
    const prompt = buildRankedSystemPrompt();
    expect(prompt).toContain("research evaluator");
    expect(prompt).toContain("numeric scale");
  });
});

describe("buildRankedEnforcementBlock", () => {
  it("includes score range in the enforcement block", () => {
    const block = buildRankedEnforcementBlock({
      scaleMin: 1,
      scaleMax: 10,
      includeReasoning: true,
    });
    expect(block).toContain("1");
    expect(block).toContain("10");
    expect(block).toContain('"score"');
    expect(block).toContain('"reasoning"');
  });

  it("omits reasoning field when includeReasoning is false", () => {
    const block = buildRankedEnforcementBlock({
      scaleMin: 1,
      scaleMax: 5,
      includeReasoning: false,
    });
    expect(block).toContain('"score"');
    expect(block).not.toContain('"reasoning"');
  });

  it("works with percentage scale (0-100)", () => {
    const block = buildRankedEnforcementBlock({
      scaleMin: 0,
      scaleMax: 100,
      includeReasoning: false,
    });
    expect(block).toContain("0");
    expect(block).toContain("100");
  });
});

describe("clampScore", () => {
  it("returns score unchanged when within range", () => {
    expect(clampScore(5, 1, 10)).toBe(5);
  });

  it("clamps score below min to min", () => {
    expect(clampScore(-1, 0, 10)).toBe(0);
  });

  it("clamps score above max to max", () => {
    expect(clampScore(15, 1, 10)).toBe(10);
  });

  it("handles boundary values", () => {
    expect(clampScore(1, 1, 10)).toBe(1);
    expect(clampScore(10, 1, 10)).toBe(10);
  });

  it("rounds non-integer scores to nearest integer", () => {
    expect(clampScore(3.7, 1, 5)).toBe(4);
    expect(clampScore(3.2, 1, 5)).toBe(3);
  });
});
