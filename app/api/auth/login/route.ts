import { NextRequest, NextResponse } from "next/server";
import { authConfigured, cookieName, createSession, passwordMatchesAsync, sessionLifetime } from "@/src/lib/auth";

export async function POST(request: NextRequest) {
  if (!authConfigured()) return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 });
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  if (typeof body?.password !== "string" || body.password.length > 256 || !(await passwordMatchesAsync(body.password))) return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, createSession(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: sessionLifetime });
  return response;
}
