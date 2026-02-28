import type {
  LlmProvider,
  LlmRequestOptions,
  LlmRawResponse,
} from "./types";

export class GeminiProvider implements LlmProvider {
  public readonly name = "gemini";

  async sendRequest(_options: LlmRequestOptions): Promise<LlmRawResponse> {
    throw new Error("Provider not implemented: gemini");
  }
}

export class PerplexityProvider implements LlmProvider {
  public readonly name = "perplexity";

  async sendRequest(_options: LlmRequestOptions): Promise<LlmRawResponse> {
    throw new Error("Provider not implemented: perplexity");
  }
}

export class CopilotProvider implements LlmProvider {
  public readonly name = "copilot";

  async sendRequest(_options: LlmRequestOptions): Promise<LlmRawResponse> {
    throw new Error("Provider not implemented: copilot");
  }
}
