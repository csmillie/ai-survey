import { describe, it, expect } from "vitest";
import { repairAndParseJson } from "@/lib/json-repair";

describe("repairAndParseJson", () => {
  it("parses valid JSON", () => {
    const { parsed, error } = repairAndParseJson(
      '{"answerText":"hello","citations":[]}'
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.answerText).toBe("hello");
    expect(error).toBeUndefined();
  });

  it("strips markdown code fences", () => {
    const raw = '```json\n{"answerText":"hello","citations":[]}\n```';
    const { parsed } = repairAndParseJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.answerText).toBe("hello");
  });

  it("extracts JSON from leading text", () => {
    const raw = 'Here is the JSON: {"answerText":"hello","citations":[]}';
    const { parsed } = repairAndParseJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.answerText).toBe("hello");
  });

  it("handles trailing commas", () => {
    const raw = '{"answerText":"hello","citations":[],}';
    const { parsed } = repairAndParseJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.answerText).toBe("hello");
  });

  it("normalizes smart quotes", () => {
    const raw = '{\u201CanswerText\u201D: \u201Chello\u201D, "citations": []}';
    const { parsed } = repairAndParseJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.answerText).toBe("hello");
  });

  it("returns null and an error for invalid JSON", () => {
    const { parsed, error } = repairAndParseJson("not json at all");
    expect(parsed).toBeNull();
    expect(error).toBeDefined();
    expect(typeof error).toBe("string");
  });

  it("returns null when required citations field is missing", () => {
    const { parsed, error } = repairAndParseJson('{"answerText":"hello"}');
    expect(parsed).toBeNull();
    expect(error).toBeDefined();
  });
});
