import { chmod, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getStoredPostizCredential } from "./credentials";

export type PostizTest = { status: "success" | "failed"; testedAt: string; reason?: string; channelCount?: number };
export type PostizSettings = { apiUrl: string; apiKey: string; lastTest?: PostizTest };

/** Resolved per call so tests never read the operator's real saved settings. */
function filePath(): string {
  return process.env.POSTIZ_SETTINGS_PATH || path.join(process.cwd(), "storage/postiz-settings.json");
}

const defaultApiUrl = "https://api.postiz.com/public/v1";

function normalizeApiUrl(value: string | undefined): string {
  if (typeof value !== "string" || !value.trim()) return defaultApiUrl;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return defaultApiUrl;
    if (url.protocol === "http:" && !/^(localhost|127\\.|0\\.0\\.0\\.0|::1)$/i.test(url.hostname)) return defaultApiUrl;
    return value.trim().replace(/\/$/, "");
  } catch { return defaultApiUrl; }
}

async function readStored(): Promise<Partial<Pick<PostizSettings, "apiUrl" | "lastTest">>> {
  try { return JSON.parse(await readFile(filePath(), "utf8")) as Partial<Pick<PostizSettings, "apiUrl" | "lastTest">>; }
  catch { return {}; }
}

export async function getPostizSettings(): Promise<PostizSettings> {
  const stored = await readStored();
  return {
    apiUrl: normalizeApiUrl(stored.apiUrl || process.env.POSTIZ_API_URL),
    apiKey: await getStoredPostizCredential() || process.env.POSTIZ_API_KEY || "",
    lastTest: stored.lastTest
  };
}

export async function savePostizSettings(input: { apiUrl?: string; lastTest?: PostizTest }): Promise<PostizSettings> {
  const current = await getPostizSettings();
  const next = { apiUrl: normalizeApiUrl(input.apiUrl || current.apiUrl), lastTest: input.lastTest || current.lastTest };
  const target = filePath();
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, JSON.stringify(next, null, 2), { mode: 0o600 });
  await chmod(target, 0o600);
  return { ...next, apiKey: current.apiKey };
}

export function safePostizSettings(settings: PostizSettings) {
  return { configured: Boolean(settings.apiKey), apiUrl: settings.apiUrl, lastTest: settings.lastTest };
}
