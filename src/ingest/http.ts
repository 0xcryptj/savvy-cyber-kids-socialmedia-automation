import { safeFetch } from "@/src/lib/safe-fetch";

const defaultHeaders = {
  Accept: "application/json, text/html, application/rss+xml",
  "User-Agent": "SavvyCyberKidsSocialBot/0.1"
};

/**
 * `noStore` bypasses Next's fetch cache entirely. It is set only when a human
 * asks for an update, so the button always returns genuinely current content
 * rather than whatever the cache last held.
 */
function requestInit(revalidate: number, noStore: boolean): RequestInit {
  return {
    headers: defaultHeaders,
    signal: AbortSignal.timeout(12000),
    ...(noStore ? { cache: "no-store" as const } : { next: { revalidate } })
  };
}

export async function fetchText(url: string, revalidate = 300, noStore = false): Promise<string> {
  // Feed items and article URLs are attacker-influenceable, so these go through
  // the guard rather than straight to fetch.
  const response = await safeFetch(url, requestInit(revalidate, noStore));
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
  return response.text();
}

export async function fetchJson<T>(url: string, revalidate = 300, noStore = false): Promise<T> {
  const response = await safeFetch(url, requestInit(revalidate, noStore));
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
  const body = await response.text();
  if (!body.trim()) throw new Error(`Empty JSON response (${response.status}): ${url}`);
  try { return JSON.parse(body) as T; }
  catch { throw new Error(`Invalid JSON response (${response.status}): ${url}`); }
}
