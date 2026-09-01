import { chmod, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { documents } from "@/src/storage";
import { getStoredPostizCredential } from "./credentials";

export type PostizTest = { status: "success" | "failed"; testedAt: string; reason?: string; channelCount?: number };
/** Where a resolved value came from, so the UI can say which one is in force. */
export type SettingSource = "saved" | "environment" | "default";
export type PostizSettings = {
  apiUrl: string;
  apiKey: string;
  lastTest?: PostizTest;
  apiUrlSource: SettingSource;
  apiKeySource: "saved" | "environment" | "none";
};

type StoredPostiz = { apiUrl?: string; lastTest?: PostizTest };

/** Resolved per call so tests never read the operator's real saved settings. */
function filePath(): string {
  return process.env.POSTIZ_SETTINGS_PATH || path.join(process.cwd(), "storage/postiz-settings.json");
}

const defaultApiUrl = "https://api.postiz.com/public/v1";

function isLoopback(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host === "::1" || host === "0.0.0.0" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

function normalizeApiUrl(value: string | undefined): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    // Plain http is only safe on the loopback interface, which is where a
    // self-hosted Postiz usually sits. `127.` alone never matched a real
    // address, so 127.0.0.1 and [::1] were being rejected and silently
    // downgraded to the cloud URL.
    if (url.protocol === "http:" && !isLoopback(url.hostname)) return undefined;
    return value.trim().replace(/\/$/, "");
  } catch { return undefined; }
}

async function readStored(): Promise<StoredPostiz> {
  if (process.env.NODE_ENV === "production" && (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN)) return (await documents.read<StoredPostiz>("postiz-settings")) ?? {};
  try { return JSON.parse(await readFile(/* turbopackIgnore: true */ filePath(), "utf8")) as StoredPostiz; }
  catch { return {}; }
}

export async function getPostizSettings(): Promise<PostizSettings> {
  const stored = await readStored();
  const savedUrl = normalizeApiUrl(stored.apiUrl);
  const envUrl = normalizeApiUrl(process.env.POSTIZ_API_URL);
  const savedKey = await getStoredPostizCredential();
  const envKey = process.env.POSTIZ_API_KEY;
  return {
    apiUrl: savedUrl ?? envUrl ?? defaultApiUrl,
    apiUrlSource: savedUrl ? "saved" : envUrl ? "environment" : "default",
    apiKey: savedKey || envKey || "",
    apiKeySource: savedKey ? "saved" : envKey ? "environment" : "none",
    lastTest: stored.lastTest
  };
}

/**
 * Persists only what the caller actually set.
 *
 * Writing back a resolved apiUrl would pin it permanently: a connection test,
 * or any unrelated settings save, would silently shadow POSTIZ_API_URL for good
 * and there would be no way to tell from the file that it had happened.
 */
export async function savePostizSettings(input: { apiUrl?: string; lastTest?: PostizTest }): Promise<PostizSettings> {
  const stored = await readStored();
  const explicitUrl = normalizeApiUrl(input.apiUrl);
  // An empty string is a deliberate clear: fall back to the environment again.
  const clearing = typeof input.apiUrl === "string" && !input.apiUrl.trim();
  const apiUrl = explicitUrl ?? (clearing ? undefined : normalizeApiUrl(stored.apiUrl));
  const next: StoredPostiz = { ...(apiUrl ? { apiUrl } : {}), ...(input.lastTest ?? stored.lastTest ? { lastTest: input.lastTest ?? stored.lastTest } : {}) };

  const target = filePath();
  if (process.env.NODE_ENV === "production" && (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN)) {
    await documents.write("postiz-settings", next);
    return getPostizSettings();
  }
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, JSON.stringify(next, null, 2), { mode: 0o600 });
  await chmod(target, 0o600);
  return getPostizSettings();
}

export function safePostizSettings(settings: PostizSettings) {
  return {
    configured: Boolean(settings.apiKey),
    apiUrl: settings.apiUrl,
    apiUrlSource: settings.apiUrlSource,
    apiKeySource: settings.apiKeySource,
    lastTest: settings.lastTest
  };
}

/**
 * Where a human opens Postiz, derived from the API URL already configured.
 *
 * The dashboard hands posts over and then gets out of the way, so it has to be
 * able to point at the calendar the reviewer just sent work to. Asking for a
 * second URL in Settings would be one more thing to get wrong, and the API URL
 * already names the deployment: the cloud API is fronted by platform.postiz.com,
 * and a self-hosted API sits on the same origin as the app it belongs to.
 */
export function postizAppUrl(apiUrl: string): string | undefined {
  try {
    const url = new URL(apiUrl);
    if (url.hostname === "api.postiz.com") return "https://platform.postiz.com";
    const path = url.pathname.replace(/\/+$/, "").replace(/\/public\/v\d+$/, "").replace(/\/api$/, "");
    return `${url.origin}${path}`;
  } catch { return undefined; }
}
