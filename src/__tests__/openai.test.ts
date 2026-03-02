import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LlmRequestOptions } from "@/providers/types";

// ---------------------------------------------------------------------------
// Mock the openai SDK
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockCreate } };
  },
}));

// Import AFTER mock is set up
import { OpenAIProvider } from "@/providers/openai";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(overrides: {
  content?: string | null;
  promptTokens?: number;
  completionTokens?: number;
} = {}) {
  return {
    choices: [
      {
        message: {
          content: Object.hasOwn(overrides, "content")
            ? overrides.content
            : "Hello from OpenAI",
        },
      },
    ],
    usage: {
      prompt_tokens: overrides.promptTokens ?? 10,
      completion_tokens: overrides.completionTokens ?? 20,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIProvider("test-api-key");
  });

  it("sends messages with correct role mapping", async () => {
    mockCreate.mockResolvedValue(makeResponse());

    const options: LlmRequestOptions = {
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ],
    };

    await provider.sendRequest(options);

    const call = mockCreate.mock.calls[0][0];
    expect(call.messages).toEqual([
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
    ]);
  });

  it("passes model name and config to SDK", async () => {
    mockCreate.mockResolvedValue(makeResponse());

    await provider.sendRequest({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
      maxTokens: 2048,
      temperature: 0.5,
    });

    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe("gpt-4o");
    expect(call.max_tokens).toBe(2048);
    expect(call.temperature).toBe(0.5);
  });

  it("maps usage fields to inputTokens/outputTokens", async () => {
    mockCreate.mockResolvedValue(
      makeResponse({ promptTokens: 42, completionTokens: 99 })
    );

    const result = await provider.sendRequest({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.usage.inputTokens).toBe(42);
    expect(result.usage.outputTokens).toBe(99);
  });

  it("falls back to 0 tokens when usage is absent", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "response" } }],
      usage: undefined,
    });

    const result = await provider.sendRequest({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
  });

  it("throws when response content is null", async () => {
    mockCreate.mockResolvedValue(makeResponse({ content: null }));

    await expect(
      provider.sendRequest({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toThrow("OpenAI returned an empty response");
  });

  it("throws when response content is an empty string", async () => {
    mockCreate.mockResolvedValue(makeResponse({ content: "" }));

    await expect(
      provider.sendRequest({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toThrow("OpenAI returned an empty response");
  });

  it("throws when choices array is empty", async () => {
    mockCreate.mockResolvedValue({ choices: [], usage: undefined });

    await expect(
      provider.sendRequest({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toThrow("OpenAI returned an empty response");
  });

  it("returns text and latency for successful response", async () => {
    mockCreate.mockResolvedValue(makeResponse());

    const result = await provider.sendRequest({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.text).toBe("Hello from OpenAI");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("uses default maxTokens and temperature when not specified", async () => {
    mockCreate.mockResolvedValue(makeResponse());

    await provider.sendRequest({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });

    const call = mockCreate.mock.calls[0][0];
    expect(call.max_tokens).toBe(4096);
    expect(call.temperature).toBe(0.7);
  });

  it("passes topP to the API call", async () => {
    mockCreate.mockResolvedValue(makeResponse());
    await provider.sendRequest({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
      topP: 0.5,
    });
    const call = mockCreate.mock.calls[0][0];
    expect(call.top_p).toBe(0.5);
  });

  it("defaults topP to 1 when not provided", async () => {
    mockCreate.mockResolvedValue(makeResponse());
    await provider.sendRequest({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });
    const call = mockCreate.mock.calls[0][0];
    expect(call.top_p).toBe(1);
  });
});
