"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, hashPassword, verifyPassword } from "@/lib/auth";
import {
  updateProfileSchema,
  changePasswordSchema,
  disableAccountSchema,
} from "@/lib/schemas";
import {
  createAuditEvent,
  PROFILE_UPDATED,
  PASSWORD_CHANGED,
  ACCOUNT_DISABLED,
} from "@/lib/audit";

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function updateProfileAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  const raw = {
    name: formData.get("name") || undefined,
  };

  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: `Invalid profile data: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
    };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { name: parsed.data.name ?? null },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: PROFILE_UPDATED,
    targetType: "User",
    targetId: session.userId,
    meta: { name: parsed.data.name ?? null },
  });

  revalidatePath("/app/settings");
  return { success: true };
}

export async function changePasswordAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  const raw = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { passwordHash: true },
  });

  const currentValid = await verifyPassword(
    parsed.data.currentPassword,
    user.passwordHash
  );
  if (!currentValid) {
    return { success: false, error: "Current password is incorrect." };
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: newHash },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: PASSWORD_CHANGED,
    targetType: "User",
    targetId: session.userId,
  });

  return { success: true };
}

export async function disableAccountAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSession();

  const raw = {
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = disableAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { passwordHash: true },
  });

  const passwordValid = await verifyPassword(
    parsed.data.confirmPassword,
    user.passwordHash
  );
  if (!passwordValid) {
    return { success: false, error: "Password is incorrect." };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { disabledAt: new Date() },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: ACCOUNT_DISABLED,
    targetType: "User",
    targetId: session.userId,
  });

  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/login");
}
