import { chmod, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { AIProvider } from "./ai-settings";

type StoredCredentials = Partial<Record<AIProvider, string>>;
const filePath = path.join(process.cwd(), "storage/credentials.json");

async function readCredentials(): Promise<StoredCredentials> {
  try { return JSON.parse(await readFile(filePath, "utf8")) as StoredCredentials; }
  catch { return {}; }
}

export async function getStoredCredential(provider: AIProvider): Promise<string | undefined> {
  const credentials = await readCredentials();
  return credentials[provider];
}

export async function saveStoredCredential(provider: AIProvider, value: string): Promise<void> {
  if (value.length > 1000 || /[\r\n]/.test(value)) throw new Error("API key is invalid");
  const credentials = await readCredentials();
  if (value.trim()) credentials[provider] = value.trim();
  else delete credentials[provider];
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await writeFile(filePath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  await chmod(filePath, 0o600);
}
