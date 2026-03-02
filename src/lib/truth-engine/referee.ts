// ---------------------------------------------------------------------------
// AI Referee Pass — calls an LLM to arbitrate disagreements per question
// ---------------------------------------------------------------------------

import { z } from "zod";
import { getProvider } from "@/providers/registry";
import { FORMATTING_SYSTEM_PROMPT } from "@/providers/types";
import { repairAndParseJsonRaw } from "@/lib/json-repair";
import type { ExtractedClaim, NumericDisagreement } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RefereeDisagreement {
  type: "numeric" | "factual" | "assumption";
  description: string;
  models: string[];
  severity: "low" | "medium" | "high";
}

export interface RefereeChecklistItem {
  item: string;
  why: string;
  suggested_source: string;
}

export interface RefereeResult {
  summary: string;
  disagreements: RefereeDisagreement[];
  verifyChecklist: RefereeChecklistItem[];
  recommendedAnswerModelKey: string | null;
  confidence: number;
  raw: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Zod schemas for referee response validation
// ---------------------------------------------------------------------------

const refereeDisagreementSchema = z.object({
  type: z.enum(["numeric", "factual", "assumption"]),
  description: z.string(),
  models: z.array(z.string()),
  severity: z.enum(["low", "medium", "high"]),
});

const refereeChecklistSchema = z.object({
  item: z.string(),
  why: z.string(),
  suggested_source: z.string(),
});

const refereeResponseSchema = z.object({
  summary: z.string(),
  disagreements: z.array(refereeDisagreementSchema),
  verify_checklist: z.array(refereeChecklistSchema),
  recommended_answer_model: z.string().nullable(),
  confidence: z.number().min(0).max(100),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFEREE_MODEL = "gpt-4o-mini";
const REFEREE_MAX_TOKENS = 400;
const REFEREE_TIMEOUT_MS = 30_000;
const MAX_ANSWER_LENGTH = 500;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildRefereePrompt(
  questionText: string,
  modelAnswers: Array<{ modelKey: string; text: string }>,
  claims: ExtractedClaim[],
  disagreements: NumericDisagreement[]
): string {
  const answersBlock = modelAnswers
    .map(
      (a) =>
        `[${a.modelKey}]: ${a.text.slice(0, MAX_ANSWER_LENGTH)}${a.text.length > MAX_ANSWER_LENGTH ? "..." : ""}`
    )
    .join("\n\n");

  const claimsSummary =
    claims.length > 0
      ? claims
          .slice(0, 10) // Limit to keep prompt short
          .map((c) => `- [${c.modelKey}] (${c.kind}): ${c.text.slice(0, 100)}`)
          .join("\n")
      : "No claims extracted.";

  const disagreementsSummary =
    disagreements.length > 0
      ? disagreements
          .map(
            (d) =>
              `- ${d.values.map((v) => `${v.modelKey}: ${v.value}${v.unit ?? ""}`).join(" vs ")} (delta: ${d.maxDelta.toFixed(2)})`
          )
          .join("\n")
      : "No numeric disagreements detected.";

  return `You are an AI referee. Analyze the following model answers to a question and identify disagreements.

QUESTION: ${questionText}

MODEL ANSWERS:
${answersBlock}

EXTRACTED CLAIMS:
${claimsSummary}

NUMERIC DISAGREEMENTS:
${disagreementsSummary}

Respond with ONLY valid JSON (no markdown fences):
{
  "summary": "Brief summary of agreement/disagreement across models",
  "disagreements": [
    {"type": "numeric|factual|assumption", "description": "...", "models": ["model1", "model2"], "severity": "low|medium|high"}
  ],
  "verify_checklist": [
    {"item": "Claim to verify", "why": "Why it matters", "suggested_source": "official/statistics/regulator/etc"}
  ],
  "recommended_answer_model": "modelKey or null",
  "confidence": 0-100
}

Keep your response concise. Focus on the most significant disagreements.`;
}

// ---------------------------------------------------------------------------
// Referee execution
// ---------------------------------------------------------------------------

/**
 * Run the AI referee for a single question.
 * Returns null on failure (graceful fallback).
 */
export async function runReferee(params: {
  questionText: string;
  modelAnswers: Array<{ modelKey: string; text: string }>;
  claims: ExtractedClaim[];
  disagreements: NumericDisagreement[];
}): Promise<RefereeResult | null> {
  try {
    const provider = getProvider("OPENAI");

    const prompt = buildRefereePrompt(
      params.questionText,
      params.modelAnswers,
      params.claims,
      params.disagreements
    );

    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REFEREE_TIMEOUT_MS);

    let response;
    try {
      response = await provider.sendRequest({
        model: REFEREE_MODEL,
        messages: [
          { role: "system", content: "You are an impartial AI referee." },
          { role: "system", content: FORMATTING_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        maxTokens: REFEREE_MAX_TOKENS,
        temperature: 0,
        topP: 1,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Parse response — use raw parser since referee JSON shape differs from llmResponseSchema
    const rawResult = repairAndParseJsonRaw(response.text);

    if (!rawResult.ok) {
      console.warn(`[referee] Failed to parse referee response: ${rawResult.error}`);
      return null;
    }

    const result = refereeResponseSchema.safeParse(rawResult.parsed);
    if (!result.success) {
      console.warn(
        `[referee] Referee response validation failed: ${result.error.message}`
      );
      return null;
    }

    return {
      summary: result.data.summary,
      disagreements: result.data.disagreements,
      verifyChecklist: result.data.verify_checklist,
      recommendedAnswerModelKey: result.data.recommended_answer_model,
      confidence: result.data.confidence,
      raw: rawResult.parsed as Record<string, unknown>,
    };
  } catch (err) {
    console.warn(
      `[referee] Referee pass failed:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
