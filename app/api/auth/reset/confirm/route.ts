import { NextRequest, NextResponse } from "next/server";
import { documents, hashResetToken, setPassword } from "@/src/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { token?: unknown; password?: unknown } | null;
  if (typeof body?.token !== "string" || typeof body.password !== "string" || body.password.length < 12 || body.password.length > 256) return NextResponse.json({ error: "Invalid reset request" }, { status: 400 });
  const stored = await documents.read<{ resetTokenHash?: string; resetExpires?: number }>("auth");
  if (!stored?.resetTokenHash || stored.resetTokenHash !== hashResetToken(body.token) || !stored.resetExpires || stored.resetExpires < Date.now()) return NextResponse.json({ error: "Reset link is invalid or expired" }, { status: 400 });
  await setPassword(body.password);
  await documents.update("auth", current => ({ ...(current ?? {}), resetTokenHash: undefined, resetExpires: undefined }));
  return NextResponse.json({ ok: true });
}
