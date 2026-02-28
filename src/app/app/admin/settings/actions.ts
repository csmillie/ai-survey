"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { updateSystemSettingSchema } from "@/lib/schemas";
import { createAuditEvent, SETTINGS_UPDATED } from "@/lib/audit";

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function updateSettingAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAdmin();

  const raw = {
    key: formData.get("key"),
    value: formData.get("value"),
  };

  const parsed = updateSystemSettingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  await prisma.systemSetting.upsert({
    where: { key: parsed.data.key },
    create: { key: parsed.data.key, value: parsed.data.value },
    update: { value: parsed.data.value },
  });

  await createAuditEvent({
    actorUserId: session.userId,
    action: SETTINGS_UPDATED,
    targetType: "SystemSetting",
    targetId: parsed.data.key,
    meta: { value: parsed.data.value },
  });

  revalidatePath("/app/admin/settings");
  return { success: true };
}
