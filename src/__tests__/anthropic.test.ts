import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LlmRequestOptions } from "@/providers/types";

// ---------------------------------------------------------------------------
// Mock the @anthropic-ai/sdk
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

// Import AFTER mock is set up
import { AnthropicProvider } from "@/providers/anthropic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(
  overrides: {
    text?: string;
    inputTokens?: number;
    outputTokens?: number;
  } = {}
) {
  return {
    content: [{ type: "text", text: overrides.text ?? "Hello from Anthropic" }],
    usage: {
      input_tokens: overrides.inputTokens ?? 10,
      output_tokens: overrides.outputTokens ?? 20,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AnthropicProvider", () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AnthropicProvider("test-api-key");
  });

  it("passes top_p to the API call when temperature is not provided", async () => {
    mockCreate.mockResolvedValue(makeResponse());
    await provider.sendRequest({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "Hello" }],
      topP: 0.5,
    });
    const call = mockCreate.mock.calls[0][0];
    expect(call.top_p).toBe(0.5);
  });

  it("omits top_p when temperature is explicitly provided", async () => {
    mockCreate.mockResolvedValue(makeResponse());
    await provider.sendRequest({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "Hello" }],
      temperature: 0,
      topP: 1,
    });
    const call = mockCreate.mock.calls[0][0];
    expect(call).not.toHaveProperty("top_p");
  });

  it("extracts system messages into system field", async () => {
    mockCreate.mockResolvedValue(makeResponse());

    const options: LlmRequestOptions = {
      model: "claude-sonnet-4-6",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ],
    };

    await provider.sendRequest(options);

    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toBe("You are helpful.");
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].role).toBe("user");
  });

  it("joins multiple system messages with double newline", async () => {
    mockCreate.mockResolvedValue(makeResponse());

    await provider.sendRequest({
      model: "claude-sonnet-4-6",
      messages: [
        { role: "system", content: "Rule one." },
        { role: "system", content: "Rule two." },
        { role: "user", content: "Hello" },
      ],
    });

    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toBe("Rule one.\n\nRule two.");
  });

  it("omits system field when no system messages are present", async () => {
    mockCreate.mockResolvedValue(makeResponse());

    await provider.sendRequest({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "Hello" }],
    });

    const call = mockCreate.mock.calls[0][0];
    expect(call).not.toHaveProperty("system");
  });

  it("maps usage fields to inputTokens/outputTokens", async () => {
    mockCreate.mockResolvedValue(
      makeResponse({ inputTokens: 42, outputTokens: 99 })
    );

    const result = await provider.sendRequest({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.usage.inputTokens).toBe(42);
    expect(result.usage.outputTokens).toBe(99);
  });

  it("throws when response contains no text block", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "x" }],
      usage: { input_tokens: 5, output_tokens: 0 },
    });

    await expect(
      provider.sendRequest({
        model: "claude-sonnet-4-6",
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toThrow("Anthropic returned no text content block");
  });

  it("passes model, maxTokens, and temperature to SDK", async () => {
    mockCreate.mockResolvedValue(makeResponse());

    await provider.sendRequest({
      model: "claude-opus-4-6",
      messages: [{ role: "user", content: "Hello" }],
      maxTokens: 2048,
      temperature: 0.3,
    });

    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe("claude-opus-4-6");
    expect(call.max_tokens).toBe(2048);
    expect(call.temperature).toBe(0.3);
  });
});
