import { chmod, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type HandoffTest = { status: "success" | "failed"; testedAt: string; reason?: string };
export type HandoffSettings = { makeWebhookUrl: string; appPublicUrl: string; lastTest?: HandoffTest };

const filePath = path.join(process.cwd(), "storage/handoff-settings.json");
const emptySettings: HandoffSettings = { makeWebhookUrl: "", appPublicUrl: "" };

function isLocalhost(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "");
  return /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|::1)$/i.test(normalized);
}

export function normalizeHandoffUrl(value: string | undefined, kind: "webhook" | "public", fallback = ""): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const candidate = value.trim().slice(0, 2048);
  try {
    const url = new URL(candidate);
    const local = isLocalhost(url.hostname);
    if (url.protocol !== "https:" && !(kind === "webhook" && url.protocol === "http:" && local)) return fallback;
    if (kind === "public" && local) return fallback;
    return candidate.replace(/\/$/, "");
  } catch { return fallback; }
}

export function isValidHandoffUrl(value: string, kind: "webhook" | "public"): boolean {
  return Boolean(normalizeHandoffUrl(value, kind));
}

async function readStored(): Promise<Partial<HandoffSettings>> {
  try { return JSON.parse(await readFile(filePath, "utf8")) as Partial<HandoffSettings>; }
  catch { return {}; }
}

export async function getHandoffSettings(): Promise<HandoffSettings> {
  const stored = await readStored();
  return {
    makeWebhookUrl: normalizeHandoffUrl(stored.makeWebhookUrl, "webhook", ""),
    appPublicUrl: normalizeHandoffUrl(stored.appPublicUrl, "public", ""),
    lastTest: stored.lastTest
  };
}

export async function getEffectiveHandoffSettings(): Promise<HandoffSettings> {
  const stored = await getHandoffSettings();
  return {
    ...stored,
    makeWebhookUrl: stored.makeWebhookUrl || normalizeHandoffUrl(process.env.MAKE_WEBHOOK_URL, "webhook", ""),
    appPublicUrl: stored.appPublicUrl || normalizeHandoffUrl(process.env.APP_PUBLIC_URL, "public", "")
  };
}

export async function saveHandoffSettings(input: Partial<HandoffSettings>): Promise<HandoffSettings> {
  const current = await getHandoffSettings();
  const next: HandoffSettings = {
    makeWebhookUrl: normalizeHandoffUrl(input.makeWebhookUrl, "webhook", current.makeWebhookUrl),
    appPublicUrl: normalizeHandoffUrl(input.appPublicUrl, "public", current.appPublicUrl),
    lastTest: current.lastTest
  };
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await writeFile(filePath, JSON.stringify(next, null, 2), { mode: 0o600 });
  await chmod(filePath, 0o600);
  return next;
}

export async function saveHandoffTest(lastTest: HandoffTest): Promise<void> {
  const current = await getHandoffSettings();
  await saveHandoffSettings({ ...current, lastTest });
}

export function publicAssetUrl(graphicPath: string | undefined, publicOrigin: string): string | undefined {
  if (!graphicPath) return undefined;
  if (/^https?:\/\//i.test(graphicPath)) return graphicPath;
  try { return new URL(graphicPath, publicOrigin).toString(); }
  catch { return undefined; }
}

export function publicUrlError(): string {
  return "Public app URL is not configured - set it in Settings before handing off posts";
}

export function safeHandoffSettings(settings: HandoffSettings) {
  return {
    makeWebhookConfigured: Boolean(settings.makeWebhookUrl),
    appPublicUrlConfigured: Boolean(settings.appPublicUrl),
    lastTest: settings.lastTest
  };
}
