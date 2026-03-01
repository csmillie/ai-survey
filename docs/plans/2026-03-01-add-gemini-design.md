# Add Google Gemini Provider — Design

## Overview

Add Gemini as a third LLM provider alongside OpenAI and Anthropic. The infrastructure is already scaffolded (`GEMINI` in the `Provider` enum, stub in the registry). This work implements the adapter and wires it up.

## SDK

**Package:** `@google/genai` (official Google Gen AI JS SDK)
**API method:** `ai.models.generateContent()` for single-turn content generation.

## API Mapping

| LlmProvider interface | Gemini SDK |
|---|---|
| `system` messages | `config.systemInstruction` (separated, like Anthropic) |
| `user` messages | `role: "user"`, `parts: [{ text }]` |
| `assistant` messages | `role: "model"`, `parts: [{ text }]` |
| `maxTokens` | `config.maxOutputTokens` |
| `temperature` | `config.temperature` |
| `inputTokens` | `usageMetadata.promptTokenCount` |
| `outputTokens` | `usageMetadata.candidatesTokenCount` |
| Response text | `response.text` |

## Files

1. **`src/providers/gemini.ts`** — New adapter implementing `LlmProvider`.
2. **`src/providers/registry.ts`** — Replace Gemini stub with real instantiation.
3. **`src/lib/env.ts`** — Add `getGeminiApiKey()` and `getWorkerConcurrencyGemini()`.
4. **`.env.example`** — Add `GEMINI_API_KEY`.
5. **`prisma/seed.ts`** — Seed gemini-2.0-flash and gemini-2.5-pro.
6. **`package.json`** — Add `@google/genai` dependency.

## Seed Data

| Model | Cost-Effective | Input $/M tokens | Output $/M tokens |
|---|---|---|---|
| gemini-2.0-flash | yes | $0.10 | $0.40 |
| gemini-2.5-pro | no | $1.25 | $10.00 |
