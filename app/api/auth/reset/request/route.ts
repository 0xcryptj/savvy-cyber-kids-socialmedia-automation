import { NextRequest, NextResponse } from "next/server";
import { createResetToken, documents, hashResetToken } from "@/src/lib/auth";

const authorizedResetEmails = ["info@savvycyberkids.org", "joarbiser@gmail.com"];
const resendTestOwnerEmail = "joarbiser@gmail.com";

function resetRecipients(): string[] {
  const from = process.env.RESEND_FROM_EMAIL ?? "";
  if (from && !from.toLowerCase().includes("@resend.dev")) return authorizedResetEmails;
  return [resendTestOwnerEmail];
}

async function resendErrorMessage(response: Response): Promise<string> {
  const fallback = "The email service could not accept the reset request. Check RESEND_API_KEY. RESEND_FROM_EMAIL is optional unless you have a verified Resend domain.";
  const body = await response.text().catch(() => "");
  if (body) console.error("Password reset email was rejected by Resend", response.status, body);
  else console.error("Password reset email was rejected by Resend", response.status);
  if (response.status === 403) return "Resend rejected the sender or recipient. If RESEND_FROM_EMAIL uses onboarding@resend.dev, it can only send to the Resend account owner. Verify a domain in Resend and set RESEND_FROM_EMAIL to an address on that domain.";
  return fallback;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const response = NextResponse.json({ ok: true });
  const requestedEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!authorizedResetEmails.includes(requestedEmail)) return response;
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "Password reset email is not configured. Set RESEND_API_KEY in the running environment. RESEND_FROM_EMAIL is optional unless you have a verified Resend domain." }, { status: 503 });
  const token = createResetToken();
  await documents.update<{ resetTokenHash?: string; resetExpires?: number }>("auth", current => ({ ...(current ?? {}), resetTokenHash: hashResetToken(token), resetExpires: Date.now() + 1000 * 60 * 30 }));
  const origin = new URL(request.url).origin;
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const html = `<!doctype html><html><body style="margin:0;background:#08090b;color:#f3f3f5;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:36px 20px"><div style="background:#141519;border:1px solid #30323a;border-radius:16px;padding:34px"><div style="color:#8b8d95;font-size:11px;font-weight:700;letter-spacing:2px">SAVVY CYBER KIDS</div><h1 style="margin:12px 0 8px;font-size:28px;color:#f3f3f5">Reset your workspace password</h1><p style="margin:0 0 24px;color:#c7c9ce;font-size:15px;line-height:1.6">Use this secure link to choose a new workspace password. The link expires in 30 minutes.</p><a href="${resetUrl}" style="display:inline-block;background:#f3f3f1;color:#0c0d0f;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px">Choose new password</a><p style="margin:24px 0 0;color:#8b8d95;font-size:12px;line-height:1.5">If you did not request this, contact the workspace administrator immediately.</p></div><p style="text-align:center;color:#5c5f68;font-size:11px;margin:18px 0 0">Savvy Cyber Kids secure workspace</p></div></body></html>`;
  const emailResponse = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL ?? "Savvy Cyber Kids <onboarding@resend.dev>", to: resetRecipients(), subject: "Savvy Cyber Kids workspace password reset", text: `Choose a new workspace password here:\n\n${resetUrl}\n\nThis link expires in 30 minutes.`, html }) });
  if (!emailResponse.ok) {
    await documents.update<{ resetTokenHash?: string; resetExpires?: number }>("auth", current => ({ ...(current ?? {}), resetTokenHash: undefined, resetExpires: undefined }));
    return NextResponse.json({ error: await resendErrorMessage(emailResponse) }, { status: 503 });
  }
  return response;
}
