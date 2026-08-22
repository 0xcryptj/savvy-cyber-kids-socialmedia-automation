import { NextRequest, NextResponse } from "next/server";
import { getAISettings, providerHasCredential, saveAISettings, AIProvider } from "@/src/config/ai-settings";
import { saveStoredCredential } from "@/src/config/credentials";
import { sameOrigin } from "@/src/lib/request-security";
import { getPostizSettings, safePostizSettings, savePostizSettings, PostizTest } from "@/src/config/postiz-settings";
import { saveStoredPostizCredential } from "@/src/config/credentials";
import { testPostizConnection } from "@/src/integrations/postiz";

export async function GET() {
  const settings = await getAISettings();
  const postiz = await getPostizSettings();
  return NextResponse.json({ ...settings, configured: await providerHasCredential(settings.provider), postiz: safePostizSettings(postiz), providers: [
    { id: "openai", label: "OpenAI", hint: "Hosted OpenAI models", models: ["gpt-4o-mini", "gpt-4o"] },
    { id: "anthropic", label: "Anthropic", hint: "Hosted Claude models", models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"] },
    { id: "openai-compatible", label: "OpenAI-compatible", hint: "OpenRouter, Groq, Together, Ollama, or your own endpoint", models: [] }
  ] });
}

export async function PATCH(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const body = await request.json() as { provider?: AIProvider; model?: string; baseUrl?: string; apiKey?: string; postizApiKey?: string; postizApiUrl?: string };
  if (body.provider && !["openai", "anthropic", "openai-compatible"].includes(body.provider)) return NextResponse.json({ error: "Unsupported AI provider" }, { status: 400 });
  const settings = await saveAISettings(body);
  if (typeof body.apiKey === "string" && body.provider) await saveStoredCredential(body.provider, body.apiKey);
  if (typeof body.postizApiKey === "string") await saveStoredPostizCredential(body.postizApiKey);
  const postiz = await savePostizSettings({ apiUrl: body.postizApiUrl });
  return NextResponse.json({ ...settings, configured: await providerHasCredential(settings.provider), postiz: safePostizSettings(postiz) });
}

export async function POST(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const postiz = await getPostizSettings();
  if (!postiz.apiKey) return NextResponse.json({ error: "Set a Postiz API key first" }, { status: 400 });
  try {
    const channelCount = await testPostizConnection();
    const testedAt = new Date().toISOString();
    await savePostizSettings({ lastTest: { status: "success", testedAt, channelCount } });
    return NextResponse.json({ status: "success", testedAt, channelCount });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Connectivity test failed";
    const testedAt = new Date().toISOString();
    await savePostizSettings({ lastTest: { status: "failed", testedAt, reason } as PostizTest });
    return NextResponse.json({ error: reason, testedAt }, { status: 502 });
  }
}
