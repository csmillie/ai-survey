import { GoogleGenAI } from "@google/genai";
import type {
  LlmProvider,
  LlmRequestOptions,
  LlmRawResponse,
  LlmMessage,
} from "./types";

export class GeminiProvider implements LlmProvider {
  public readonly name = "gemini";
  private readonly client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
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

    const response = await this.client.models.generateContent({
      model: options.model,
      contents: conversationMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: {
        maxOutputTokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        ...(systemText.length > 0 ? { systemInstruction: systemText } : {}),
      },
    });

    const latencyMs = Date.now() - start;

    const text = response.text;
    if (!text) {
      const finishReason = response.candidates?.[0]?.finishReason;
      throw new Error(
        `Gemini returned no text content${finishReason ? ` (finishReason: ${finishReason})` : ""}`
      );
    }

    return {
      text,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      },
      latencyMs,
    };
  }
}
