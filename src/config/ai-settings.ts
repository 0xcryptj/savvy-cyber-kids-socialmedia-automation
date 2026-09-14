import { documents } from "@/src/storage";
import { getStoredCredential } from "./credentials";

export type AIProvider = "openai" | "anthropic" | "openai-compatible";
export type AISettings = { provider: AIProvider; model: string; baseUrl?: string };

export const providerModels: Record<AIProvider, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  "openai-compatible": []
};

function defaultProvider(): AIProvider {
  return (process.env.AI_PROVIDER as AIProvider) || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
}

function defaultModel(provider: AIProvider): string {
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  if (provider === "anthropic") return "claude-sonnet-4-6";
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

function defaultSettings(): AISettings {
  const provider = defaultProvider();
  return {
    provider,
    model: defaultModel(provider),
    baseUrl: process.env.AI_BASE_URL || ""
  };
}

export async function getAISettings(): Promise<AISettings> {
  return { ...defaultSettings(), ...(await documents.read<Partial<AISettings>>("settings")) };
}

export async function saveAISettings(input: Partial<AISettings>): Promise<AISettings> {
  const current = await getAISettings();
  const candidateModel = typeof input.model === "string" ? input.model.trim().slice(0, 120) : "";
  const next: AISettings = {
    provider: input.provider === "openai" || input.provider === "anthropic" || input.provider === "openai-compatible" ? input.provider : current.provider,
    model: candidateModel && /^[A-Za-z0-9._:/-]+$/.test(candidateModel) ? candidateModel : current.model,
    baseUrl: normalizeBaseUrl(input.baseUrl, current.baseUrl)
  };
  await documents.write("settings", next);
  return next;
}

export function providerIsConfigured(provider: AIProvider): boolean {
  return Boolean(provider === "anthropic" ? process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY : process.env.OPENAI_API_KEY || process.env.AI_API_KEY);
}

export async function providerHasCredential(provider: AIProvider): Promise<boolean> {
  return Boolean((await getStoredCredential(provider)) || providerIsConfigured(provider));
}

export async function providerCredentialStatus(): Promise<Record<AIProvider, boolean>> {
  return {
    openai: await providerHasCredential("openai"),
    anthropic: await providerHasCredential("anthropic"),
    "openai-compatible": await providerHasCredential("openai-compatible")
  };
}

export function normalizeBaseUrl(value: string | undefined, fallback = ""): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const candidate = value.trim().slice(0, 500);
  try {
    const url = new URL(candidate);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return fallback;
    return candidate.replace(/\/$/, "");
  } catch { return fallback; }
}
