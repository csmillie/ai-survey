import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const ALGORITHM = "HS256";

export async function middleware(request: NextRequest) {
  const session = request.cookies.get("session");

  if (!session?.value) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Verify JWT signature and expiration
  try {
    // Read JWT_SECRET directly from process.env because middleware runs in
    // Edge Runtime and cannot import @/lib/env helpers (Node.js only).
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    const key = new TextEncoder().encode(secret);
    await jwtVerify(session.value, key, { algorithms: [ALGORITHM] });
  } catch {
    // Invalid or expired token — clear cookie and redirect
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("session");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
