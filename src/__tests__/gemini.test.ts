import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LlmRequestOptions } from "@/providers/types";

// ---------------------------------------------------------------------------
// Mock the @google/genai SDK
// ---------------------------------------------------------------------------

const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
}));

// Import AFTER mock is set up
import { GeminiProvider } from "@/providers/gemini";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(overrides: {
  text?: string | undefined;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  finishReason?: string;
} = {}) {
  return {
    text: Object.hasOwn(overrides, "text")
      ? overrides.text
      : "Hello from Gemini",
    usageMetadata: {
      promptTokenCount: overrides.promptTokenCount ?? 10,
      candidatesTokenCount: overrides.candidatesTokenCount ?? 20,
    },
    candidates: overrides.finishReason
      ? [{ finishReason: overrides.finishReason }]
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GeminiProvider", () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GeminiProvider("test-api-key");
  });

  it("extracts system messages into systemInstruction", async () => {
    mockGenerateContent.mockResolvedValue(makeResponse());

    const options: LlmRequestOptions = {
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ],
    };

    await provider.sendRequest(options);

    const call = mockGenerateContent.mock.calls[0][0];
    expect(call.config.systemInstruction).toBe("You are helpful.");
    // System messages should NOT appear in contents
    expect(call.contents).toHaveLength(1);
    expect(call.contents[0].role).toBe("user");
  });

  it("joins multiple system messages with double newline", async () => {
    mockGenerateContent.mockResolvedValue(makeResponse());

    const options: LlmRequestOptions = {
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: "Rule one." },
        { role: "system", content: "Rule two." },
        { role: "user", content: "Hello" },
      ],
    };

    await provider.sendRequest(options);

    const call = mockGenerateContent.mock.calls[0][0];
    expect(call.config.systemInstruction).toBe("Rule one.\n\nRule two.");
  });

  it("omits systemInstruction when no system messages are present", async () => {
    mockGenerateContent.mockResolvedValue(makeResponse());

    const options: LlmRequestOptions = {
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: "Hello" }],
    };

    await provider.sendRequest(options);

    const call = mockGenerateContent.mock.calls[0][0];
    expect(call.config).not.toHaveProperty("systemInstruction");
  });

  it("remaps assistant role to model", async () => {
    mockGenerateContent.mockResolvedValue(makeResponse());

    const options: LlmRequestOptions = {
      model: "gemini-2.0-flash",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: "Follow up" },
      ],
    };

    await provider.sendRequest(options);

    const call = mockGenerateContent.mock.calls[0][0];
    expect(call.contents[0].role).toBe("user");
    expect(call.contents[1].role).toBe("model");
    expect(call.contents[2].role).toBe("user");
  });

  it("maps usageMetadata fields to inputTokens/outputTokens", async () => {
    mockGenerateContent.mockResolvedValue(
      makeResponse({ promptTokenCount: 42, candidatesTokenCount: 99 })
    );

    const result = await provider.sendRequest({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.usage.inputTokens).toBe(42);
    expect(result.usage.outputTokens).toBe(99);
  });

  it("falls back to 0 tokens when usageMetadata is absent", async () => {
    mockGenerateContent.mockResolvedValue({
      text: "response",
      usageMetadata: undefined,
    });

    const result = await provider.sendRequest({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
  });

  it("throws when response text is null/undefined", async () => {
    mockGenerateContent.mockResolvedValue(
      makeResponse({ text: undefined })
    );

    await expect(
      provider.sendRequest({
        model: "gemini-2.0-flash",
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toThrow("Gemini returned no text content");
  });

  it("includes finishReason in error when text is missing", async () => {
    mockGenerateContent.mockResolvedValue({
      text: undefined,
      usageMetadata: undefined,
      candidates: [{ finishReason: "SAFETY" }],
    });

    await expect(
      provider.sendRequest({
        model: "gemini-2.0-flash",
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toThrow("finishReason: SAFETY");
  });

  it("allows empty string responses through", async () => {
    mockGenerateContent.mockResolvedValue(makeResponse({ text: "" }));

    const result = await provider.sendRequest({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.text).toBe("");
  });

  it("wraps message content in parts array", async () => {
    mockGenerateContent.mockResolvedValue(makeResponse());

    await provider.sendRequest({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: "test content" }],
    });

    const call = mockGenerateContent.mock.calls[0][0];
    expect(call.contents[0].parts).toEqual([{ text: "test content" }]);
  });

  it("passes model name and config to SDK", async () => {
    mockGenerateContent.mockResolvedValue(makeResponse());

    await provider.sendRequest({
      model: "gemini-2.5-pro",
      messages: [{ role: "user", content: "Hello" }],
      maxTokens: 2048,
      temperature: 0.5,
    });

    const call = mockGenerateContent.mock.calls[0][0];
    expect(call.model).toBe("gemini-2.5-pro");
    expect(call.config.maxOutputTokens).toBe(2048);
    expect(call.config.temperature).toBe(0.5);
  });
});
