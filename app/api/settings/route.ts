import { NextRequest, NextResponse } from "next/server";
import { getAISettings, providerHasCredential, saveAISettings, AIProvider } from "@/src/config/ai-settings";
import { saveStoredCredential } from "@/src/config/credentials";
import { sameOrigin } from "@/src/lib/request-security";
import { getEffectiveHandoffSettings, isValidHandoffUrl, safeHandoffSettings, saveHandoffSettings, saveHandoffTest } from "@/src/config/handoff-settings";

export async function GET() {
  const settings = await getAISettings();
  const handoff = await getEffectiveHandoffSettings();
  return NextResponse.json({ ...settings, configured: await providerHasCredential(settings.provider), handoff: safeHandoffSettings(handoff), providers: [
    { id: "openai", label: "OpenAI", hint: "GPT-4o and GPT-4o mini" },
    { id: "anthropic", label: "Anthropic", hint: "Claude Sonnet and Claude Haiku" },
    { id: "openai-compatible", label: "OpenAI-compatible", hint: "OpenRouter, Groq, Together, Ollama, or your own endpoint" }
  ] });
}

export async function PATCH(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const body = await request.json() as { provider?: AIProvider; model?: string; baseUrl?: string; apiKey?: string; makeWebhookUrl?: string; appPublicUrl?: string };
  if (body.provider && !["openai", "anthropic", "openai-compatible"].includes(body.provider)) return NextResponse.json({ error: "Unsupported AI provider" }, { status: 400 });
  if (body.makeWebhookUrl?.trim() && !isValidHandoffUrl(body.makeWebhookUrl, "webhook")) return NextResponse.json({ error: "Make.com Webhook URL must use HTTPS (HTTP is allowed only for localhost)" }, { status: 400 });
  if (body.appPublicUrl?.trim() && !isValidHandoffUrl(body.appPublicUrl, "public")) return NextResponse.json({ error: "Public App URL must be an internet-reachable HTTPS URL, not localhost" }, { status: 400 });
  const settings = await saveAISettings(body);
  if (typeof body.apiKey === "string" && body.provider) await saveStoredCredential(body.provider, body.apiKey);
  const handoff = await saveHandoffSettings({ makeWebhookUrl: body.makeWebhookUrl, appPublicUrl: body.appPublicUrl });
  return NextResponse.json({ ...settings, configured: await providerHasCredential(settings.provider), handoff: safeHandoffSettings(handoff) });
}

export async function POST(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const settings = await getEffectiveHandoffSettings();
  if (!settings.makeWebhookUrl) return NextResponse.json({ error: "Set a webhook URL first" }, { status: 400 });
  try {
    const response = await fetch(settings.makeWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "test-ping", message: "Savvy Cyber Kids connectivity test" }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);
    const testedAt = new Date().toISOString();
    await saveHandoffTest({ status: "success", testedAt });
    return NextResponse.json({ status: "success", testedAt });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Connectivity test failed";
    const testedAt = new Date().toISOString();
    await saveHandoffTest({ status: "failed", testedAt, reason });
    return NextResponse.json({ error: reason, testedAt }, { status: 502 });
  }
}
