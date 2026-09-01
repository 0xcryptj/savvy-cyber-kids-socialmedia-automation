import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { documents } from "@/src/storage";
import type { AIProvider } from "./ai-settings";

type StoredCredentials = Partial<Record<AIProvider, string>> & { postiz?: string };

type EncryptedCredentials = { v: 1; iv: string; tag: string; data: string };

function encryptionKey(): Buffer | undefined {
  const raw = process.env.SCK_CREDENTIALS_ENCRYPTION_KEY;
  return raw && raw.length >= 32 ? createHash("sha256").update(raw).digest() : undefined;
}

function decrypt(value: StoredCredentials | EncryptedCredentials | undefined): StoredCredentials | undefined {
  if (!value || !("v" in value)) return value as StoredCredentials | undefined;
  const key = encryptionKey(); if (!key) throw new Error("Credential encryption is not configured");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, "base64url")), decipher.final()]).toString("utf8")) as StoredCredentials;
}

function encrypt(value: StoredCredentials): EncryptedCredentials {
  const key = encryptionKey(); if (!key) { if (process.env.NODE_ENV === "production") throw new Error("Credential encryption is not configured"); return value as unknown as EncryptedCredentials; }
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv); const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { v: 1, iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), data: data.toString("base64url") };
}

function assertUsable(value: string): void {
  if (value.length > 1000 || /[\r\n]/.test(value)) throw new Error("API key is invalid");
}

async function setCredential(field: AIProvider | "postiz", value: string): Promise<void> {
  assertUsable(value);
  await documents.update<StoredCredentials | EncryptedCredentials>("credentials", (raw) => {
    const next = { ...(decrypt(raw) ?? {}) };
    if (value.trim()) next[field] = value.trim();
    else delete next[field];
    return encrypt(next);
  });
}

export async function getStoredCredential(provider: AIProvider): Promise<string | undefined> {
  return decrypt(await documents.read<StoredCredentials | EncryptedCredentials>("credentials"))?.[provider];
}

export async function saveStoredCredential(provider: AIProvider, value: string): Promise<void> {
  await setCredential(provider, value);
}

export async function getStoredPostizCredential(): Promise<string | undefined> {
  return decrypt(await documents.read<StoredCredentials | EncryptedCredentials>("credentials"))?.postiz;
}

export async function saveStoredPostizCredential(value: string): Promise<void> {
  await setCredential("postiz", value);
}
