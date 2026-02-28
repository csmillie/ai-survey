# Prompt Contract & JSON Enforcement (v1)

All survey questions MUST instruct the LLM to return ONLY valid JSON in this shape:

```json
{
  "answerText": "string",
  "citations": [
    { "url": "https://example.com", "title": "optional", "snippet": "optional" }
  ],
  "notes": "optional"
}
```

## Rules
1. Return ONLY JSON (no markdown, no backticks, no surrounding text).
2. `citations` must be an array.
3. Each citation MUST include a `url`. Title/snippet are optional.
4. If you cannot find sources, return `"citations": []` and explain briefly in `notes`.

## Standard instruction block (append to EVERY user prompt)
Use this exact block appended after the rendered prompt:

---
You MUST respond with ONLY valid JSON and no other text.

JSON schema:
- answerText: string (your long-form answer)
- citations: array of objects with:
  - url: string
  - title: string (optional)
  - snippet: string (optional)
- notes: string (optional)

If you have no citations, set citations to an empty array.

Do not wrap the JSON in markdown code fences.
---

## JSON repair strategy (server-side)
Even with enforcement, models can sometimes output:
- markdown fences
- leading/trailing commentary
- trailing commas
- unescaped newlines

Server should:
1. Attempt strict JSON parse.
2. If fail:
   - strip ``` fences
   - take substring from first `{` to last `}`
   - normalize smart quotes
   - remove trailing commas
3. Validate with Zod.
4. If still invalid:
   - store rawText
   - set parsedJson null
   - add analysis flag: `invalid_json`

## Threading behavior (v1 recommendation)
- Stateless questions use a fresh message list:
  - system (global)
  - user (rendered question prompt + enforcement block)
- Threaded questions use ConversationThread.messagesJson for that (runId, model, threadKey):
  - append user message
  - append assistant response (raw)
  - persist updated messagesJson

## Variable substitution
Render templates like `Hello {{brand}}` by:
- replacing `{{key}}` with resolved values for that run
- fail if unresolved (or provide UI warning) depending on strictness setting
