import OpenAI from "openai";
import type {
  LlmProvider,
  LlmRequestOptions,
  LlmRawResponse,
} from "./types";

export class OpenAIProvider implements LlmProvider {
  public readonly name = "openai";
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async sendRequest(options: LlmRequestOptions): Promise<LlmRawResponse> {
    const start = Date.now();

    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
    });

    const latencyMs = Date.now() - start;

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error("OpenAI returned an empty response");
    }

    const text = choice.message.content;

    const usage = response.usage;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;

    return {
      text,
      usage: { inputTokens, outputTokens },
      latencyMs,
    };
  }
}
