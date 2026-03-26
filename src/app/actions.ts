"use server";

import { prisma } from "@/lib/db";
import { betaSignupSchema } from "@/lib/schemas";
import { getBetaNotifyEmail } from "@/lib/env";

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

  try {
    await prisma.betaSignup.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        company: parsed.data.company,
        role: parsed.data.role,
      },
    });
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return { error: "This email is already on the waitlist." };
    }
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
