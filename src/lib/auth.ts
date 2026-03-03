import { hash, compare } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getJwtSecret, getSessionMaxAgeSeconds } from "@/lib/env";
import { prisma } from "@/lib/db";

const HASH_ROUNDS = 12;
const ALGORITHM = "HS256";
const COOKIE_NAME = "session";

interface SessionPayload {
  userId: string;
  role: string;
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

/**
 * Hash a plaintext password with bcrypt (12 rounds).
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return compare(password, passwordHash);
}

/**
 * Create a signed JWT session token containing userId and role.
 * Expires according to SESSION_MAX_AGE_SECONDS.
 */
export async function createSession(
  userId: string,
  role: string
): Promise<string> {
  const maxAge = getSessionMaxAgeSeconds();
  const token = await new SignJWT({ userId, role } satisfies SessionPayload)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecretKey());
  return token;
}

/**
 * Verify a JWT session token and return the payload, or null if invalid/expired.
 */
export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(
      token,
      getSecretKey(),
      { algorithms: [ALGORITHM] }
    );

    if (
      typeof payload.userId !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

/**
 * Read the session cookie and verify it.
 * Returns the session payload or null if not authenticated.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  const session = await verifySession(sessionCookie.value);
  if (!session) {
    return null;
  }

  // Check if account has been disabled since token was issued
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { disabledAt: true },
  });

  if (!user || user.disabledAt) {
    return null;
  }

  return session;
}

/**
 * Require an authenticated session. Redirects to /login if not authenticated.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Require an ADMIN session. Redirects to /login if not authenticated,
 * or to / if authenticated but not an admin.
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    redirect("/");
  }
  return session;
}
