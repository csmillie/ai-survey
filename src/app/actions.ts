"use server";

import { prisma } from "@/lib/db";
import { betaSignupSchema } from "@/lib/schemas";
import { getBetaNotifyEmail } from "@/lib/env";
import { encryptEmail, hashEmail } from "@/lib/encryption";

interface BetaSignupState {
  success?: boolean;
  error?: string;
}

export async function betaSignupAction(
  _prevState: BetaSignupState | null,
  formData: FormData,
): Promise<BetaSignupState> {
  const raw = {
    email: formData.get("email"),
    name: formData.get("name"),
    company: formData.get("company") || undefined,
    role: formData.get("role") || undefined,
  };

  const parsed = betaSignupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const emailForStorage = encryptEmail(parsed.data.email);
  const emailForDedup = hashEmail(parsed.data.email);

  try {
    await prisma.betaSignup.create({
      data: {
        email: emailForStorage,
        emailHash: emailForDedup,
        name: parsed.data.name,
        company: parsed.data.company,
        role: parsed.data.role,
      },
    });
  } catch (err: unknown) {
    // Prisma unique constraint: P2002
    const prismaError = err as { code?: string };
    if (prismaError.code === "P2002") {
      return { error: "This email is already on the waitlist." };
    }
    console.error("[beta-signup] Error:", err);
    return { error: "Something went wrong. Please try again." };
  }

  const notifyEmail = getBetaNotifyEmail();
  if (notifyEmail) {
    console.log(
      `[beta-signup] New signup: ${parsed.data.email} (${parsed.data.name})` +
        ` — notify: ${notifyEmail}`
    );
  }

  return { success: true };
}
