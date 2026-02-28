import type { LlmProvider } from "./types";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import {
  GeminiProvider,
  PerplexityProvider,
  CopilotProvider,
} from "./stubs";
import { getOpenaiApiKey, getAnthropicApiKey } from "@/lib/env";

export type ProviderName =
  | "OPENAI"
  | "ANTHROPIC"
  | "GEMINI"
  | "PERPLEXITY"
  | "COPILOT";

export function getProvider(provider: ProviderName | string): LlmProvider {
  switch (provider) {
    case "OPENAI":
      return new OpenAIProvider(getOpenaiApiKey());
    case "ANTHROPIC":
      return new AnthropicProvider(getAnthropicApiKey());
    case "GEMINI":
      return new GeminiProvider();
    case "PERPLEXITY":
      return new PerplexityProvider();
    case "COPILOT":
      return new CopilotProvider();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
