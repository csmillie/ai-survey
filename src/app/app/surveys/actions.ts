"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { createSurveySchema } from "@/lib/schemas";
import { requireSurveyAccess } from "@/lib/survey-auth";
import {
  createAuditEvent,
  SURVEY_CREATED,
  SURVEY_DELETED,
} from "@/lib/audit";

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
