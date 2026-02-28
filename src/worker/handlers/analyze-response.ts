import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AnalyzeResponsePayload } from "@/lib/queue";
import { analyzeSentiment } from "@/lib/analysis/sentiment";
import {
  extractEntities,
  extractBrandMentions,
  extractInstitutionMentions,
} from "@/lib/analysis/entities";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedLlmResponse {
  answerText: string;
  citations?: Array<{ url: string; title?: string; snippet?: string }>;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleAnalyzeResponse(
  payload: AnalyzeResponsePayload
): Promise<void> {
  const { responseId, jobId } = payload;

  try {
    // 1. Load LlmResponse
    const llmResponse = await prisma.llmResponse.findUnique({
      where: { id: responseId },
    });

    if (!llmResponse) {
      console.warn(`LlmResponse ${responseId} not found, skipping analysis`);
      await markJobSucceeded(jobId);
      return;
    }

    // 2. If parsedJson is null, flag as invalid
    if (llmResponse.parsedJson === null) {
      await prisma.analysisResult.create({
        data: {
          responseId,
          flagsJson: ["invalid_json"] as unknown as Prisma.InputJsonValue,
        },
      });
      await markJobSucceeded(jobId);
      return;
    }

    // 3. Extract answer text
    const parsed = llmResponse.parsedJson as unknown as ParsedLlmResponse;
    const answerText = parsed.answerText ?? "";

    if (!answerText) {
      await prisma.analysisResult.create({
        data: {
          responseId,
          flagsJson: ["empty_answer"] as unknown as Prisma.InputJsonValue,
        },
      });
      await markJobSucceeded(jobId);
      return;
    }

    // 4. Run analysis
    const sentimentScore = analyzeSentiment(answerText);
    const entities = extractEntities(answerText);
    const brandMentions = extractBrandMentions(answerText);
    const institutionMentions = extractInstitutionMentions(answerText);

    // 5. Build flags
    const flags: string[] = [];
    if (answerText.length < 20) {
      flags.push("short_answer");
    }
    if (Math.abs(sentimentScore) > 0.8) {
      flags.push("extreme_sentiment");
    }

    // 6. Create AnalysisResult
    await prisma.analysisResult.create({
      data: {
        responseId,
        sentimentScore,
        entitiesJson: entities as unknown as Prisma.InputJsonValue,
        brandMentionsJson: brandMentions as unknown as Prisma.InputJsonValue,
        institutionMentionsJson:
          institutionMentions as unknown as Prisma.InputJsonValue,
        flagsJson:
          flags.length > 0
            ? (flags as unknown as Prisma.InputJsonValue)
            : undefined,
      },
    });

    await markJobSucceeded(jobId);
  } catch (err) {
    // Mark analyze job as failed
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          lastError: err instanceof Error ? err.message : "Unknown error",
        },
      });
    } catch {
      // Ignore if job update fails
    }
    throw err;
  }
}

async function markJobSucceeded(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "SUCCEEDED",
      finishedAt: new Date(),
    },
  });
}
