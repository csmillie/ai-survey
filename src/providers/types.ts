export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequestOptions {
  model: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmRawResponse {
  text: string;
  usage: LlmUsage;
  latencyMs: number;
}

export interface LlmProvider {
  name: string;
  sendRequest(options: LlmRequestOptions): Promise<LlmRawResponse>;
}

export const JSON_ENFORCEMENT_BLOCK = `\n\n---\nYou MUST respond with ONLY valid JSON and no other text.\n\nJSON schema:\n- answerText: string (your long-form answer)\n- citations: array of objects with:\n  - url: string\n  - title: string (optional)\n  - snippet: string (optional)\n- confidence: integer (0-100, how confident you are in this answer)\n- notes: string (optional)\n\nIf you have no citations, set citations to an empty array.\n\nDo not wrap the JSON in markdown code fences.\n---`;

export const FORMATTING_SYSTEM_PROMPT = `You are a formatting engine.
Output exactly what is requested with no extra words, punctuation, or explanation.`;
