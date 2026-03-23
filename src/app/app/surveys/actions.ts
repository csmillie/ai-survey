"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { createSurveySchema } from "@/lib/schemas";
import { requireSurveyAccess } from "@/lib/survey-auth";
import {
  createAuditEvent,
  SURVEY_CREATED,
  SURVEY_DELETED,
} from "@/lib/audit";
import { importSurveyJsonSchema, mapImportToSurvey } from "@/lib/survey-import";

export async function createSurveyAction(formData: FormData): Promise<{ error: string }> {
  const session = await requireSession();

  const raw = {
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  };

  const parsed = createSurveySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: `Invalid survey data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }

  const survey = await prisma.survey.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      ownerId: session.userId,
    },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: SURVEY_CREATED,
    targetType: "Survey",
    targetId: survey.id,
    meta: { title: survey.title },
  });

  redirect(`/app/surveys/${survey.id}`);
}

export async function deleteSurveyAction(formData: FormData): Promise<{ error: string }> {
  const session = await requireSession();

  const surveyId = formData.get("surveyId");
  if (typeof surveyId !== "string" || !surveyId) {
    return { error: "Missing surveyId" };
  }

  await requireSurveyAccess(session.userId, surveyId, "EDIT");

  await prisma.survey.update({
    where: { id: surveyId },
    data: { deletedAt: new Date() },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: SURVEY_DELETED,
    targetType: "Survey",
    targetId: surveyId,
  });

  redirect("/app/surveys");
}

// ---------------------------------------------------------------------------
// Import Survey from JSON
// ---------------------------------------------------------------------------

export async function importSurveyAction(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await requireSession();

  const jsonString = formData.get("json");
  if (typeof jsonString !== "string" || !jsonString.trim()) {
    return { error: "No JSON data provided" };
  }

  // 1. Parse raw JSON
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(jsonString);
  } catch {
    return { error: "Invalid JSON: could not parse file contents" };
  }

  // 2. Validate structure with Zod
  const parseResult = importSurveyJsonSchema.safeParse(rawJson);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => i.message).join(", ");
    return { error: `Invalid survey format: ${issues}` };
  }

  // 3. Map to internal types
  let mapped;
  try {
    mapped = mapImportToSurvey(parseResult.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to map survey data" };
  }

  // 4. Create survey + questions in a transaction
  const survey = await prisma.$transaction(async (tx) => {
    const s = await tx.survey.create({
      data: {
        title: mapped.title,
        description: mapped.description,
        ownerId: session.userId,
        isBenchmarkInstrument: mapped.isBenchmarkInstrument,
        benchmarkSource: mapped.benchmarkSource,
        benchmarkVersion: mapped.benchmarkVersion,
        executionMode: mapped.executionMode,
      },
    });

    for (const q of mapped.questions) {
      await tx.question.create({
        data: {
          surveyId: s.id,
          title: q.title,
          promptTemplate: q.promptTemplate,
          order: q.order,
          type: q.type,
          configJson: q.configJson as unknown as Prisma.InputJsonValue,
          code: q.code,
          constructKey: q.constructKey,
          sourceSurvey: q.sourceSurvey,
          sourceVariable: q.sourceVariable,
          isBenchmarkAnchor: q.isBenchmarkAnchor,
          benchmarkNotes: q.benchmarkNotes,
        },
      });
    }

    return s;
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: SURVEY_CREATED,
    targetType: "Survey",
    targetId: survey.id,
    meta: {
      title: survey.title,
      importedQuestions: mapped.questions.length,
      source: "json_import",
    },
  });

  redirect(`/app/surveys/${survey.id}`);
}
