import Anthropic from "@anthropic-ai/sdk";
import type {
  LlmProvider,
  LlmRequestOptions,
  LlmRawResponse,
  LlmMessage,
} from "./types";

export class AnthropicProvider implements LlmProvider {
  public readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async sendRequest(options: LlmRequestOptions): Promise<LlmRawResponse> {
    const start = Date.now();

    const systemMessages: LlmMessage[] = [];
    const conversationMessages: LlmMessage[] = [];

    for (const msg of options.messages) {
      if (msg.role === "system") {
        systemMessages.push(msg);
      } else {
        conversationMessages.push(msg);
      }
    }

    const systemText = systemMessages.map((m) => m.content).join("\n\n");

    const response = await this.client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      ...(systemText.length > 0 ? { system: systemText } : {}),
      messages: conversationMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const latencyMs = Date.now() - start;

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Anthropic returned no text content block");
    }

    return {
      text: textBlock.text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      latencyMs,
    };
  }
}
