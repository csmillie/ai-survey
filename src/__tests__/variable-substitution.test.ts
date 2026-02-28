import { describe, it, expect } from "vitest";
import { substituteVariables } from "@/lib/variable-substitution";

describe("substituteVariables", () => {
  it("performs basic substitution", () => {
    const { result, unresolved } = substituteVariables("Hello {{name}}", {
      name: "World",
    });
    expect(result).toBe("Hello World");
    expect(unresolved).toEqual([]);
  });

  it("substitutes multiple variables", () => {
    const { result, unresolved } = substituteVariables(
      "{{greeting}} {{name}}",
      { greeting: "Hi", name: "Alice" }
    );
    expect(result).toBe("Hi Alice");
    expect(unresolved).toEqual([]);
  });

  it("reports unresolved variables and leaves them in the output", () => {
    const { result, unresolved } = substituteVariables(
      "Hello {{name}} from {{place}}",
      { name: "Bob" }
    );
    expect(result).toContain("Bob");
    expect(result).toContain("{{place}}");
    expect(unresolved).toContain("place");
    expect(unresolved).not.toContain("name");
  });

  it("returns original string when there are no variables", () => {
    const { result, unresolved } = substituteVariables("Hello World", {});
    expect(result).toBe("Hello World");
    expect(unresolved).toEqual([]);
  });

  it("substitutes repeated variables", () => {
    const { result, unresolved } = substituteVariables("{{x}} and {{x}}", {
      x: "yes",
    });
    expect(result).toBe("yes and yes");
    expect(unresolved).toEqual([]);
  });

  it("handles an empty template", () => {
    const { result, unresolved } = substituteVariables("", { name: "test" });
    expect(result).toBe("");
    expect(unresolved).toEqual([]);
  });

  it("does not resolve prototype-inherited keys like toString or constructor", () => {
    const { result, unresolved } = substituteVariables(
      "{{toString}} and {{constructor}}",
      {}
    );
    expect(result).toBe("{{toString}} and {{constructor}}");
    expect(unresolved).toContain("toString");
    expect(unresolved).toContain("constructor");
  });
});
