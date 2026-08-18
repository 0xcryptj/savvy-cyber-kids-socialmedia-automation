import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getStoredCredential } from "./credentials";

export type AIProvider = "openai" | "anthropic" | "openai-compatible";
export type AISettings = { provider: AIProvider; model: string; baseUrl?: string };

const filePath = path.join(process.cwd(), "storage/settings.json");
const defaults: AISettings = {
  provider: (process.env.AI_PROVIDER as AIProvider) || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai"),
  model: process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
  baseUrl: process.env.AI_BASE_URL || ""
};

export async function getAISettings(): Promise<AISettings> {
  try { return { ...defaults, ...(JSON.parse(await readFile(filePath, "utf8")) as Partial<AISettings>) }; }
  catch { return defaults; }
}

export async function saveAISettings(input: Partial<AISettings>): Promise<AISettings> {
  const current = await getAISettings();
  const next: AISettings = {
    provider: input.provider === "anthropic" || input.provider === "openai-compatible" ? input.provider : current.provider,
    model: typeof input.model === "string" && input.model.trim() ? input.model.trim().slice(0, 120) : current.model,
    baseUrl: normalizeBaseUrl(input.baseUrl, current.baseUrl)
  };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2));
  return next;
}

export function providerIsConfigured(provider: AIProvider): boolean {
  return Boolean(provider === "anthropic" ? process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY : process.env.OPENAI_API_KEY || process.env.AI_API_KEY);
}

export async function providerHasCredential(provider: AIProvider): Promise<boolean> {
  return Boolean((await getStoredCredential(provider)) || providerIsConfigured(provider));
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
