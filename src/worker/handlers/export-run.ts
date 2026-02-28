import { prisma } from "@/lib/db";
import type { ExportRunPayload } from "@/lib/queue";
import { createAuditEvent, EXPORT_CREATED } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedLlmResponse {
  answerText: string;
  citations?: Array<{ url: string; title?: string; snippet?: string }>;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleExportRun(
  payload: ExportRunPayload
): Promise<void> {
  const { runId } = payload;

  // 1. Load run to get createdById for audit
  const run = await prisma.surveyRun.findUnique({
    where: { id: runId },
    select: { createdById: true },
  });

  if (!run) {
    console.error(`Run ${runId} not found for export`);
    return;
  }

  // 2. Load all responses with related data
  const responses = await prisma.llmResponse.findMany({
    where: { runId },
    include: {
      question: {
        select: { title: true },
      },
      modelTarget: {
        select: { modelName: true, provider: true },
      },
      analysis: {
        select: { sentimentScore: true },
      },
    },
    orderBy: [
      { questionId: "asc" },
      { modelTargetId: "asc" },
    ],
  });

  // 3. Generate CSV
  const csvRows: string[] = [];
  csvRows.push(
    [
      "questionTitle",
      "modelName",
      "provider",
      "answerText",
      "citations",
      "sentimentScore",
      "costUsd",
    ].join(",")
  );

  for (const resp of responses) {
    const parsed = resp.parsedJson as unknown as ParsedLlmResponse | null;
    const answerText = parsed?.answerText ?? "";
    const citations = parsed?.citations ?? [];
    const citationUrls = citations.map((c) => c.url).join("; ");
    const sentiment = resp.analysis?.sentimentScore?.toFixed(3) ?? "";
    const cost = resp.costUsd?.toString() ?? "";

    csvRows.push(
      [
        csvEscape(resp.question.title),
        csvEscape(resp.modelTarget.modelName),
        csvEscape(resp.modelTarget.provider),
        csvEscape(answerText),
        csvEscape(citationUrls),
        sentiment,
        cost,
      ].join(",")
    );
  }

  const csvContent = csvRows.join("\n");

  // 4. Placeholder: in production this would save to file/S3
  console.log(
    `[export-run] Generated CSV for run ${runId} (${responses.length} responses, ${csvContent.length} bytes)`
  );

  // 5. Audit log
  await createAuditEvent({
    actorUserId: run.createdById,
    action: EXPORT_CREATED,
    targetType: "SurveyRun",
    targetId: runId,
    runTargetId: runId,
    meta: {
      responseCount: responses.length,
      csvBytes: csvContent.length,
    },
  });
}

// ---------------------------------------------------------------------------
// CSV helper
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
