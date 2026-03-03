"use server";

import { cookies, headers } from "next/headers";
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
import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetFailedLogins,
} from "@/lib/rate-limit";

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

  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    undefined;
  const userAgent = headerStore.get("user-agent") ?? undefined;

  // Look up user by email (select only needed fields)
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, role: true, disabledAt: true },
  });

  if (!user) {
    return { error: "Invalid credentials." };
  }

  // Check rate limit
  const rateLimit = await checkLoginRateLimit(user.id);
  if (rateLimit.locked) {
    const minutes = Math.ceil((rateLimit.remainingMs ?? 0) / 60_000);
    return {
      error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  // Verify password
  const passwordValid = await verifyPassword(password, user.passwordHash);

  if (!passwordValid) {
    await recordFailedLogin(user.id);
    await createAuditEvent({
      actorUserId: user.id,
      action: LOGIN_FAILED,
      targetType: "User",
      targetId: user.id,
      meta: { email },
      ip,
      userAgent,
    });
    return { error: "Invalid credentials." };
  }

  // Check after password verification to avoid leaking account state
  if (user.disabledAt) {
    return { error: "This account has been disabled." };
  }

  // Reset rate limit counters
  await resetFailedLogins(user.id);

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
    ip,
    userAgent,
  });

  // Update lastLoginAt
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  redirect("/app/surveys");
}
