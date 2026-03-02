# Design: Formatting System Prompt + Parameter Defaults

**Date:** 2026-03-02
**Branch:** question-order

## Goal

Append a fixed formatting system prompt to all LLM API calls and set `temperature: 0` and `top_p: 1` on every request to ensure deterministic, clean JSON output.

## Formatting System Prompt

```
You are a formatting engine.
Output exactly what is requested with no extra words, punctuation, or explanation.
```

This is appended after the existing system message (e.g. "You are a research assistant...") — it does not replace it.

## Changes

### `src/providers/types.ts`
- Add `FORMATTING_SYSTEM_PROMPT` constant alongside the existing `JSON_ENFORCEMENT_BLOCK`
- Add `topP?: number` to `LlmRequestOptions`

### `src/worker/handlers/execute-question.ts`
- Push a second `{ role: "system", content: FORMATTING_SYSTEM_PROMPT }` message after the existing system message
- Pass `temperature: 0, topP: 1` in the `provider.sendRequest()` call

### `src/lib/truth-engine/referee.ts`
- Append `FORMATTING_SYSTEM_PROMPT` as a second system message
- Pass `temperature: 0, topP: 1` in the `provider.sendRequest()` call

### `src/providers/openai.ts`
- Add `top_p: options.topP ?? 1` to `chat.completions.create`
- Change default temperature from `0.7` to use `options.temperature ?? 0.7` (no change — caller now always passes it explicitly)

### `src/providers/anthropic.ts`
- Add `top_p: options.topP ?? 1` to `messages.create`

### `src/providers/gemini.ts`
- Add `topP: options.topP ?? 1` to the `config` block

### `src/providers/grok.ts`
- Add `top_p: options.topP ?? 1` to `chat.completions.create` (OpenAI-compatible)

## Non-Goals
- No changes to the ranked prompt system
- No changes to the JSON enforcement block
- No UI changes
