import { documents } from "@/src/storage";
import { getStoredCredential } from "./credentials";

export type AIProvider = "openai" | "anthropic" | "openai-compatible";
export type AISettings = { provider: AIProvider; model: string; baseUrl?: string; anthropicWorkspaceId?: string };

export const providerModels: Record<AIProvider, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-sonnet-5", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  "openai-compatible": []
};

function defaultProvider(): AIProvider {
  return (process.env.AI_PROVIDER as AIProvider) || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
}

function defaultModel(provider: AIProvider): string {
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  if (provider === "anthropic") return "claude-sonnet-5";
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

function defaultSettings(): AISettings {
  const provider = defaultProvider();
  return {
    provider,
    model: defaultModel(provider),
    baseUrl: process.env.AI_BASE_URL || "",
    anthropicWorkspaceId: process.env.ANTHROPIC_WORKSPACE_ID || ""
  };
}

function normalizeModel(provider: AIProvider, value: string | undefined, fallback: string): string {
  const candidate = typeof value === "string" ? value.trim().slice(0, 120) : "";
  const presets = providerModels[provider];
  if (presets.length) return candidate && presets.includes(candidate) ? candidate : defaultModel(provider);
  return candidate && /^[A-Za-z0-9._:/-]+$/.test(candidate) ? candidate : fallback;
}

export async function getAISettings(): Promise<AISettings> {
  const defaults = defaultSettings();
  const stored = await documents.read<Partial<AISettings>>("settings");
  const provider = stored?.provider === "openai" || stored?.provider === "anthropic" || stored?.provider === "openai-compatible" ? stored.provider : defaults.provider;
  return { provider, model: normalizeModel(provider, stored?.model, defaults.model), baseUrl: stored?.baseUrl ?? defaults.baseUrl, anthropicWorkspaceId: normalizeWorkspaceId(stored?.anthropicWorkspaceId ?? defaults.anthropicWorkspaceId) };
}

export async function saveAISettings(input: Partial<AISettings>): Promise<AISettings> {
  const current = await getAISettings();
  const provider = input.provider === "openai" || input.provider === "anthropic" || input.provider === "openai-compatible" ? input.provider : current.provider;
  const next: AISettings = {
    provider,
    model: normalizeModel(provider, input.model, provider === current.provider ? current.model : defaultModel(provider)),
    baseUrl: normalizeBaseUrl(input.baseUrl, current.baseUrl),
    anthropicWorkspaceId: normalizeWorkspaceId(input.anthropicWorkspaceId ?? current.anthropicWorkspaceId)
  };
  await documents.write("settings", next);
  return next;
}

export async function saveAnthropicWorkspaceId(workspaceId: string): Promise<AISettings> {
  return saveAISettings({ anthropicWorkspaceId: workspaceId });
}

export async function aiProviderConfigured(): Promise<boolean> {
  const settings = await getAISettings();
  return providerHasCredential(settings.provider);
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

function normalizeWorkspaceId(value: string | undefined): string {
  if (typeof value !== "string") return "";
  return /^[A-Za-z0-9_-]{8,200}$/.test(value.trim()) ? value.trim() : "";
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
