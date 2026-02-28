"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { createUserSchema } from "@/lib/schemas";
import {
  createAuditEvent,
  USER_CREATED,
  USER_ROLE_CHANGED,
  USER_ENABLED,
  ACCOUNT_DISABLED,
} from "@/lib/audit";

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createUserAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAdmin();

  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name") || undefined,
    role: formData.get("role") || undefined,
  };

  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (existing) {
    return { success: false, error: "A user with that email already exists." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      name: parsed.data.name ?? null,
      role: parsed.data.role ?? "USER",
    },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: USER_CREATED,
    targetType: "User",
    targetId: user.id,
    meta: { email: parsed.data.email, role: parsed.data.role ?? "USER" },
  });

  revalidatePath("/app/admin/users");
  return { success: true };
}

export async function toggleUserDisabledAction(
  formData: FormData
): Promise<void> {
  const session = await requireAdmin();
  const targetUserId = formData.get("userId") as string;

  if (targetUserId === session.userId) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, disabledAt: true },
  });

  if (!user) {
    return;
  }

  const isDisabled = user.disabledAt !== null;
  await prisma.user.update({
    where: { id: targetUserId },
    data: { disabledAt: isDisabled ? null : new Date() },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: isDisabled ? USER_ENABLED : ACCOUNT_DISABLED,
    targetType: "User",
    targetId: targetUserId,
  });

  revalidatePath("/app/admin/users");
}

export async function changeUserRoleAction(
  formData: FormData
): Promise<void> {
  const session = await requireAdmin();
  const targetUserId = formData.get("userId") as string;

  if (targetUserId === session.userId) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true },
  });

  if (!user) {
    return;
  }

  const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
  await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: USER_ROLE_CHANGED,
    targetType: "User",
    targetId: targetUserId,
    meta: { from: user.role, to: newRole },
  });

  revalidatePath("/app/admin/users");
}
