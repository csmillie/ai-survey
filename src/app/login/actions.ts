"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/schemas";
import { verifyPassword, createSession } from "@/lib/auth";
import { getSessionMaxAgeSeconds, isProduction } from "@/lib/env";
import {
  createAuditEvent,
  LOGIN_SUCCESS,
  LOGIN_FAILED,
} from "@/lib/audit";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  // Validate input
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid email or password format." };
  }

  const { email, password } = parsed.data;

  // Look up user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return { error: "Invalid credentials." };
  }

  if (user.disabledAt) {
    return { error: "This account has been disabled." };
  }

  // Verify password
  const passwordValid = await verifyPassword(password, user.passwordHash);

  if (!passwordValid) {
    await createAuditEvent({
      actorUserId: user.id,
      action: LOGIN_FAILED,
      targetType: "User",
      targetId: user.id,
      meta: { email },
    });
    return { error: "Invalid credentials." };
  }

  // Create session token
  const token = await createSession(user.id, user.role);

  // Set session cookie
  const maxAge = getSessionMaxAgeSeconds();
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  // Record successful login audit event
  await createAuditEvent({
    actorUserId: user.id,
    action: LOGIN_SUCCESS,
    targetType: "User",
    targetId: user.id,
    meta: { email },
  });

  // Update lastLoginAt
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  redirect("/app/surveys");
}
