import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { documents } from "@/src/storage";

const cookieName = "sck_session";
const sessionLifetime = 60 * 60 * 12;

function secret(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length >= 32 ? value : undefined;
}

function sign(value: string): string {
  return createHmac("sha256", secret("SCK_AUTH_SECRET") ?? "").update(value).digest("base64url");
}

export function authConfigured(): boolean {
  return Boolean(secret("SCK_AUTH_SECRET") && process.env.SCK_AUTH_PASSWORD);
}

export function passwordMatches(password: string): boolean {
  const expected = process.env.SCK_AUTH_PASSWORD;
  if (!expected || !secret("SCK_AUTH_SECRET")) return false;
  const actual = Buffer.from(password);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export async function passwordMatchesAsync(password: string): Promise<boolean> {
  const stored = await documents.read<{ passwordHash?: string }>("auth");
  if (!stored?.passwordHash) return passwordMatches(password);
  const actual = createHash("sha256").update(password).digest("hex");
  return actual.length === stored.passwordHash.length && timingSafeEqual(Buffer.from(actual), Buffer.from(stored.passwordHash));
}

export async function setPassword(password: string): Promise<void> {
  await documents.update<{ passwordHash?: string }>("auth", current => ({ ...(current ?? {}), passwordHash: createHash("sha256").update(password).digest("hex") }));
}

export function createResetToken(): string { return randomBytes(32).toString("base64url"); }
export function createTemporaryPassword(): string { return randomBytes(24).toString("base64url"); }
export function hashResetToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }

export function createSession(): string {
  const expires = Math.floor(Date.now() / 1000) + sessionLifetime;
  const value = `${expires}.${crypto.randomUUID()}`;
  return `${value}.${sign(value)}`;
}

export function validSession(value: string | undefined): boolean {
  if (!value || !secret("SCK_AUTH_SECRET")) return false;
  const [expires, nonce, signature] = value.split(".");
  if (!expires || !nonce || !signature || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const expected = sign(`${expires}.${nonce}`);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export async function isAuthenticated(): Promise<boolean> {
  return validSession((await cookies()).get(cookieName)?.value);
}

export { cookieName, sessionLifetime };
export { documents };
