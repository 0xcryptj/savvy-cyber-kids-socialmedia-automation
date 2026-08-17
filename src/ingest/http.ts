const defaultHeaders = {
  Accept: "application/json, text/html, application/rss+xml",
  "User-Agent": "SavvyCyberKidsSocialBot/0.1"
};

export async function fetchText(url: string, revalidate = 300): Promise<string> {
  const response = await fetch(url, { headers: defaultHeaders, signal: AbortSignal.timeout(12000), next: { revalidate } });
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
  return response.text();
}

export async function fetchJson<T>(url: string, revalidate = 300): Promise<T> {
  const response = await fetch(url, { headers: defaultHeaders, signal: AbortSignal.timeout(12000), next: { revalidate } });
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
  return response.json() as Promise<T>;
}
