"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireSurveyAccess } from "@/lib/survey-auth";
import {
  updateSurveySchema,
  createQuestionSchema,
  updateQuestionSchema,
  createVariableSchema,
  updateVariableSchema,
  shareSurveySchema,
} from "@/lib/schemas";
import {
  createAuditEvent,
  SURVEY_UPDATED,
  QUESTION_CREATED,
  QUESTION_UPDATED,
  QUESTION_DELETED,
  VARIABLE_CREATED,
  VARIABLE_UPDATED,
  VARIABLE_DELETED,
  SHARE_ADDED,
  SHARE_REMOVED,
} from "@/lib/audit";

// ---------------------------------------------------------------------------
// Action result type
// ---------------------------------------------------------------------------

interface ActionResult {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Survey
// ---------------------------------------------------------------------------

export async function updateSurveyAction(surveyId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  await requireSurveyAccess(session.userId, surveyId, "EDIT");

  const raw: Record<string, unknown> = {};
  const title = formData.get("title");
  const description = formData.get("description");
  if (typeof title === "string" && title.trim()) raw.title = title.trim();
  if (typeof description === "string") raw.description = description || undefined;

  const parsed = updateSurveySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: `Invalid survey data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }

  await prisma.survey.update({
    where: { id: surveyId },
    data: parsed.data,
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: SURVEY_UPDATED,
    targetType: "Survey",
    targetId: surveyId,
    meta: parsed.data as Record<string, string>,
  });

  revalidatePath(`/app/surveys/${surveyId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export async function addQuestionAction(surveyId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  await requireSurveyAccess(session.userId, surveyId, "EDIT");

  const promptTemplate = formData.get("promptTemplate");
  const titleRaw = formData.get("title");
  // Auto-generate title from prompt if not provided
  const title = (typeof titleRaw === "string" && titleRaw.trim())
    ? titleRaw.trim()
    : typeof promptTemplate === "string"
      ? promptTemplate.slice(0, 60).trim() || "Untitled Question"
      : "Untitled Question";

  const typeRaw = formData.get("type");
  const configJsonRaw = formData.get("configJson");

  let parsedConfig: unknown;
  if (typeof configJsonRaw === "string" && configJsonRaw) {
    try {
      parsedConfig = JSON.parse(configJsonRaw);
    } catch {
      return { success: false, error: "Invalid configuration JSON" };
    }
  }

  const raw = {
    title,
    promptTemplate,
    mode: formData.get("mode") || undefined,
    threadKey: formData.get("threadKey") || undefined,
    type: (typeof typeRaw === "string" && typeRaw) ? typeRaw : undefined,
    configJson: parsedConfig,
  };

  const parsed = createQuestionSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: `Invalid question data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }

  // Auto-set order to max + 1
  const maxOrder = await prisma.question.aggregate({
    where: { surveyId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const question = await prisma.question.create({
    data: {
      surveyId,
      title: parsed.data.title,
      promptTemplate: parsed.data.promptTemplate,
      mode: parsed.data.mode ?? "STATELESS",
      threadKey: parsed.data.threadKey,
      order: nextOrder,
      type: parsed.data.type ?? "OPEN_ENDED",
      configJson: parsed.data.configJson
        ? (parsed.data.configJson as unknown as Prisma.InputJsonValue)
        : undefined,
    },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: QUESTION_CREATED,
    targetType: "Question",
    targetId: question.id,
    meta: { surveyId, title: question.title },
  });

  revalidatePath(`/app/surveys/${surveyId}`);
  return { success: true };
}

export async function updateQuestionAction(
  surveyId: string,
  questionId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();
  await requireSurveyAccess(session.userId, surveyId, "EDIT");

  const raw: Record<string, unknown> = {};
  const title = formData.get("title");
  const promptTemplate = formData.get("promptTemplate");
  const mode = formData.get("mode");
  const threadKey = formData.get("threadKey");
  const type = formData.get("type");
  const configJson = formData.get("configJson");

  if (typeof title === "string" && title.trim()) raw.title = title.trim();
  if (typeof promptTemplate === "string" && promptTemplate.trim())
    raw.promptTemplate = promptTemplate.trim();
  if (typeof mode === "string" && mode) raw.mode = mode;
  if (typeof threadKey === "string") raw.threadKey = threadKey || undefined;
  if (typeof type === "string" && type) raw.type = type;
  if (typeof configJson === "string" && configJson) {
    try {
      raw.configJson = JSON.parse(configJson) as unknown;
    } catch {
      return { success: false, error: "Invalid configuration JSON" };
    }
  }

  const parsed = updateQuestionSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: `Invalid question data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }

  // Build update data, converting configJson for Prisma
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.configJson) {
    updateData.configJson = parsed.data.configJson as unknown as Prisma.InputJsonValue;
  } else if (parsed.data.type === "OPEN_ENDED") {
    updateData.configJson = Prisma.JsonNull;
  }

  await prisma.question.update({
    where: { id: questionId, surveyId },
    data: updateData,
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: QUESTION_UPDATED,
    targetType: "Question",
    targetId: questionId,
    meta: { surveyId, ...parsed.data },
  });

  revalidatePath(`/app/surveys/${surveyId}`);
  return { success: true };
}

export async function deleteQuestionAction(
  surveyId: string,
  questionId: string
): Promise<ActionResult> {
  const session = await requireSession();
  await requireSurveyAccess(session.userId, surveyId, "EDIT");

  await prisma.question.delete({
    where: { id: questionId, surveyId },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: QUESTION_DELETED,
    targetType: "Question",
    targetId: questionId,
    meta: { surveyId },
  });

  revalidatePath(`/app/surveys/${surveyId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

export async function addVariableAction(surveyId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  await requireSurveyAccess(session.userId, surveyId, "EDIT");

  const raw = {
    key: formData.get("key"),
    label: formData.get("label") || undefined,
    defaultValue: formData.get("defaultValue") || undefined,
  };

  const parsed = createVariableSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: `Invalid variable data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }

  const variable = await prisma.variable.create({
    data: {
      surveyId,
      key: parsed.data.key,
      label: parsed.data.label,
      defaultValue: parsed.data.defaultValue,
    },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: VARIABLE_CREATED,
    targetType: "Variable",
    targetId: variable.id,
    meta: { surveyId, key: variable.key },
  });

  revalidatePath(`/app/surveys/${surveyId}`);
  return { success: true };
}

export async function updateVariableAction(
  surveyId: string,
  variableId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();
  await requireSurveyAccess(session.userId, surveyId, "EDIT");

  const raw: Record<string, unknown> = {};
  const key = formData.get("key");
  const label = formData.get("label");
  const defaultValue = formData.get("defaultValue");

  if (typeof key === "string" && key.trim()) raw.key = key.trim();
  if (typeof label === "string") raw.label = label || undefined;
  if (typeof defaultValue === "string") raw.defaultValue = defaultValue || undefined;

  const parsed = updateVariableSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: `Invalid variable data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }

  await prisma.variable.update({
    where: { id: variableId, surveyId },
    data: parsed.data,
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: VARIABLE_UPDATED,
    targetType: "Variable",
    targetId: variableId,
    meta: { surveyId, ...parsed.data },
  });

  revalidatePath(`/app/surveys/${surveyId}`);
  return { success: true };
}

export async function deleteVariableAction(
  surveyId: string,
  variableId: string
): Promise<ActionResult> {
  const session = await requireSession();
  await requireSurveyAccess(session.userId, surveyId, "EDIT");

  await prisma.variable.delete({
    where: { id: variableId, surveyId },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: VARIABLE_DELETED,
    targetType: "Variable",
    targetId: variableId,
    meta: { surveyId },
  });

  revalidatePath(`/app/surveys/${surveyId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

export async function addShareAction(surveyId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  await requireSurveyAccess(session.userId, surveyId, "EDIT");

  const raw = {
    email: formData.get("email"),
    role: formData.get("role") || undefined,
  };

  const parsed = shareSurveySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: `Invalid share data: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }

  const targetUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (!targetUser) {
    return { success: false, error: "User not found with that email address" };
  }

  const share = await prisma.surveyShare.create({
    data: {
      surveyId,
      userId: targetUser.id,
      role: parsed.data.role ?? "EDIT",
    },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: SHARE_ADDED,
    targetType: "SurveyShare",
    targetId: share.id,
    meta: { surveyId, sharedWithUserId: targetUser.id, role: share.role },
  });

  revalidatePath(`/app/surveys/${surveyId}`);
  return { success: true };
}

export async function removeShareAction(surveyId: string, shareId: string): Promise<ActionResult> {
  const session = await requireSession();
  await requireSurveyAccess(session.userId, surveyId, "EDIT");

  await prisma.surveyShare.delete({
    where: { id: shareId, surveyId },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: SHARE_REMOVED,
    targetType: "SurveyShare",
    targetId: shareId,
    meta: { surveyId },
  });

  revalidatePath(`/app/surveys/${surveyId}`);
  return { success: true };
}
