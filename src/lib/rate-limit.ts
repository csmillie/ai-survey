import { prisma } from "@/lib/db";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface RateLimitCheck {
  locked: boolean;
  remainingMs?: number;
}

/**
 * Check if a user account is currently locked out due to too many failed login attempts.
 */
export async function checkLoginRateLimit(userId: string): Promise<RateLimitCheck> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true, lockedUntil: true },
  });

  if (!user) return { locked: false };

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      locked: true,
      remainingMs: user.lockedUntil.getTime() - Date.now(),
    };
  }

  return { locked: false };
}

/**
 * Record a failed login attempt. If threshold is exceeded, lock the account.
 * Uses atomic increment to avoid lost updates under concurrent requests.
 */
export async function recordFailedLogin(userId: string): Promise<void> {
  // Reset counter atomically if lock has expired, then increment
  await prisma.user.updateMany({
    where: { id: userId, lockedUntil: { not: null, lte: new Date() } },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  // Atomic increment
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });

  // Lock if threshold reached
  if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
    });
  }
}

/**
 * Reset failed login attempts on successful login.
 */
export async function resetFailedLogins(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}
