import { documents } from "@/src/storage";
import type { AIProvider } from "./ai-settings";

type StoredCredentials = Partial<Record<AIProvider, string>> & { postiz?: string };

function assertUsable(value: string): void {
  if (value.length > 1000 || /[\r\n]/.test(value)) throw new Error("API key is invalid");
}

async function setCredential(field: AIProvider | "postiz", value: string): Promise<void> {
  assertUsable(value);
  await documents.update<StoredCredentials>("credentials", (current) => {
    const next = { ...(current ?? {}) };
    if (value.trim()) next[field] = value.trim();
    else delete next[field];
    return next;
  });
}

export async function getStoredCredential(provider: AIProvider): Promise<string | undefined> {
  return (await documents.read<StoredCredentials>("credentials"))?.[provider];
}

export async function saveStoredCredential(provider: AIProvider, value: string): Promise<void> {
  await setCredential(provider, value);
}

export async function getStoredPostizCredential(): Promise<string | undefined> {
  return (await documents.read<StoredCredentials>("credentials"))?.postiz;
}

export async function saveStoredPostizCredential(value: string): Promise<void> {
  await setCredential("postiz", value);
}
