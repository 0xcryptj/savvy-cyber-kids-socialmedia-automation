import { NextRequest, NextResponse } from "next/server";
import { getAISettings, providerIsConfigured, saveAISettings, AIProvider } from "@/src/config/ai-settings";
import { sameOrigin } from "@/src/lib/request-security";

export async function GET() {
  const settings = await getAISettings();
  return NextResponse.json({ ...settings, configured: providerIsConfigured(settings.provider), providers: [
    { id: "openai", label: "OpenAI", hint: "GPT-4o and GPT-4o mini" },
    { id: "anthropic", label: "Anthropic", hint: "Claude Sonnet and Claude Haiku" },
    { id: "openai-compatible", label: "OpenAI-compatible", hint: "OpenRouter, Groq, Together, Ollama, or your own endpoint" }
  ] });
}

export async function PATCH(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const body = await request.json() as { provider?: AIProvider; model?: string; baseUrl?: string };
  if (body.provider && !["openai", "anthropic", "openai-compatible"].includes(body.provider)) return NextResponse.json({ error: "Unsupported AI provider" }, { status: 400 });
  return NextResponse.json(await saveAISettings(body));
}
