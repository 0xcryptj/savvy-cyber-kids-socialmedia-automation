import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

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
    baseUrl: typeof input.baseUrl === "string" ? input.baseUrl.trim().slice(0, 500) : current.baseUrl
  };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2));
  return next;
}

export function providerIsConfigured(provider: AIProvider): boolean {
  if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY);
  return Boolean(process.env.OPENAI_API_KEY || process.env.AI_API_KEY);
}
