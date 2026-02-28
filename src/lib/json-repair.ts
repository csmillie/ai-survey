import { llmResponseSchema, type LlmResponsePayload } from "@/lib/schemas";

interface RepairResult {
  parsed: LlmResponsePayload | null;
  error?: string;
}

/**
 * Attempt to parse a raw string as JSON conforming to the LLM response schema.
 *
 * Applies a sequence of repair strategies:
 *  1. Direct JSON.parse
 *  2. Strip markdown code fences
 *  3. Extract from first `{` to last `}`
 *  4. Normalize smart quotes
 *  5. Remove trailing commas before `}` or `]`
 *  6. Retry JSON.parse after repairs
 *  7. Validate against Zod schema
 */
export function repairAndParseJson(raw: string): RepairResult {
  // Step 1: Try direct parse
  const directResult = tryParseAndValidate(raw);
  if (directResult.parsed) return directResult;

  let text = raw;

  // Step 2: Strip markdown code fences (```json ... ``` or ``` ... ```)
  text = stripMarkdownFences(text);

  // Step 3: Extract from first { to last }
  text = extractJsonObject(text);

  if (!text) {
    return { parsed: null, error: "No JSON object found in input" };
  }

  // Step 4: Normalize smart quotes
  text = normalizeSmartQuotes(text);

  // Step 5: Remove trailing commas before } or ]
  text = removeTrailingCommas(text);

  // Step 6: Try JSON.parse again after repairs
  // Step 7: Validate with Zod
  const repairedResult = tryParseAndValidate(text);
  if (repairedResult.parsed) return repairedResult;

  return {
    parsed: null,
    error: repairedResult.error ?? "Failed to parse and validate JSON",
  };
}

function tryParseAndValidate(text: string): RepairResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (parseError: unknown) {
    const message =
      parseError instanceof Error ? parseError.message : "Invalid JSON";
    return { parsed: null, error: `JSON parse error: ${message}` };
  }

  const result = llmResponseSchema.safeParse(parsed);
  if (result.success) {
    return { parsed: result.data };
  }

  const issues = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  return { parsed: null, error: `Validation error: ${issues}` };
}

function stripMarkdownFences(text: string): string {
  // Match ```json ... ``` or ``` ... ```
  const fenceRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/;
  const match = fenceRegex.exec(text);
  if (match) {
    return match[1].trim();
  }
  return text;
}

function extractJsonObject(text: string): string {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return "";
  }
  return text.slice(firstBrace, lastBrace + 1);
}

function normalizeSmartQuotes(text: string): string {
  return text
    .replace(/\u201c/g, '"') // left double quotation mark
    .replace(/\u201d/g, '"') // right double quotation mark
    .replace(/\u2018/g, "'") // left single quotation mark
    .replace(/\u2019/g, "'"); // right single quotation mark
}

function removeTrailingCommas(text: string): string {
  // Remove commas followed by optional whitespace and then } or ]
  return text.replace(/,\s*([}\]])/g, "$1");
}
