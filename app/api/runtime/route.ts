import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/src/lib/request-security";

export const dynamic = "force-dynamic";

type Session = { lastSeen: number };
const sessions = new Map<string, Session>();
let shutdownTimer: NodeJS.Timeout | undefined;
const idleLimit = 45_000;

function expectedToken() {
  return process.env.SCK_SHUTDOWN_TOKEN;
}

function validSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9-]{16,80}$/i.test(value);
}

function validToken(value: unknown): value is string {
  const expected = expectedToken();
  return Boolean(expected && typeof value === "string" && value === expected);
}

function pruneSessions() {
  const cutoff = Date.now() - idleLimit;
  for (const [id, session] of sessions) if (session.lastSeen < cutoff) sessions.delete(id);
}

function scheduleShutdown() {
  if (!expectedToken() || sessions.size > 0 || shutdownTimer) return;
  shutdownTimer = setTimeout(() => {
    shutdownTimer = undefined;
    pruneSessions();
    if (sessions.size === 0) process.kill(process.pid, "SIGTERM");
  }, 3_000);
}

export async function GET() {
  const token = expectedToken();
  return NextResponse.json({ lifecycleEnabled: Boolean(token), token });
}

export async function POST(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const body = await request.json().catch(() => null) as { token?: unknown; sessionId?: unknown; event?: unknown } | null;
  if (!body || !validToken(body.token) || !validSessionId(body.sessionId)) return NextResponse.json({ error: "Invalid runtime session" }, { status: 403 });
  pruneSessions();
  if (body.event === "close") sessions.delete(body.sessionId);
  else sessions.set(body.sessionId, { lastSeen: Date.now() });
  scheduleShutdown();
  return NextResponse.json({ ok: true });
}
