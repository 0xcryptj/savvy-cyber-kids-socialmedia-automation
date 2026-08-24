import { getPostizSettings } from "@/src/config/postiz-settings";

/**
 * Why a hardened client instead of bare fetch: every call here crosses the
 * network to a third party that can rate limit, stall, or fail mid-batch, and a
 * blind retry of a create can double-post to a real social account. The client
 * classifies failures so callers can tell "try again" from "stop and fix it",
 * and never retries anything that is not provably safe to repeat.
 */
export type PostizErrorKind =
  | "auth"
  | "rate_limit"
  | "validation"
  | "not_found"
  | "payload_too_large"
  | "server"
  | "network"
  | "timeout";

export class PostizError extends Error {
  readonly kind: PostizErrorKind;
  readonly status?: number;
  /** Present on rate limits: how long Postiz asked us to wait. */
  readonly retryAfterMs?: number;

  constructor(kind: PostizErrorKind, message: string, options?: { status?: number; retryAfterMs?: number }) {
    super(message);
    this.name = "PostizError";
    this.kind = kind;
    this.status = options?.status;
    this.retryAfterMs = options?.retryAfterMs;
  }

  /** Whether repeating the exact same request could succeed. */
  get transient(): boolean {
    return this.kind === "rate_limit" || this.kind === "server" || this.kind === "network" || this.kind === "timeout";
  }

  /** Copy suitable for showing a reviewer in the dashboard. */
  get reviewerMessage(): string {
    if (this.kind === "auth") return "Postiz rejected the API key. Re-enter it in Settings.";
    if (this.kind === "rate_limit") {
      const minutes = this.retryAfterMs ? Math.ceil(this.retryAfterMs / 60_000) : 0;
      return minutes ? `Postiz rate limit reached. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.` : "Postiz rate limit reached. Try again shortly.";
    }
    if (this.kind === "payload_too_large") return "The graphic is larger than Postiz accepts (50 MB).";
    if (this.kind === "timeout") return "Postiz did not respond in time.";
    if (this.kind === "network") return "Could not reach Postiz. Check the connection and the API URL.";
    return this.message;
  }
}

function classify(status: number, detail?: string): PostizError {
  const message = detail || `Postiz request failed (${status})`;
  if (status === 401) return new PostizError("auth", message, { status });
  if (status === 403) return new PostizError("auth", message, { status });
  if (status === 404) return new PostizError("not_found", message, { status });
  if (status === 413) return new PostizError("payload_too_large", message, { status });
  if (status === 429) return new PostizError("rate_limit", message, { status });
  if (status >= 500) return new PostizError("server", message, { status });
  return new PostizError("validation", message, { status });
}

/** Retry-After is either seconds or an HTTP date. Both appear in the wild. */
function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 24 * 60 * 60 * 1000);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.min(date - Date.now(), 24 * 60 * 60 * 1000));
}

async function readDetail(response: Response): Promise<string | undefined> {
  const payload = await response.json().catch(() => null) as { message?: unknown; error?: unknown } | null;
  if (!payload || typeof payload !== "object") return undefined;
  const raw = payload.message ?? payload.error;
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 500);
  // Nest-style validation errors arrive as an array of strings.
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string").join("; ").slice(0, 500) || undefined;
  return undefined;
}

export type RequestOptions = {
  method?: string;
  /** JSON body. Mutually exclusive with `form`. */
  json?: unknown;
  form?: FormData;
  timeoutMs?: number;
  /**
   * Retrying a create would double-post, so only reads and uploads opt in.
   * Uploads are safe because an orphaned upload is inert until referenced.
   */
  retry?: boolean;
  signal?: AbortSignal;
};

const maxAttempts = 3;
/**
 * A 100-per-hour create budget means Retry-After can be tens of minutes. Never
 * hold a request open that long: past this cap we surface the wait to the
 * reviewer instead, so the dashboard stays responsive and they know when to retry.
 */
const maxInlineWaitMs = 15_000;

function backoffMs(attempt: number, suggested?: number): number {
  const exponential = Math.min(500 * 2 ** (attempt - 1), 8_000);
  // Jitter keeps a bulk export from re-synchronising all its retries.
  return Math.max(suggested ?? 0, exponential) + Math.random() * 250;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function postizFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const settings = await getPostizSettings();
  if (!settings.apiKey) throw new PostizError("auth", "Postiz API key is not configured - set it in Settings");

  const timeout = options.timeoutMs ?? 20_000;
  let lastError: PostizError | undefined;

  for (let attempt = 1; attempt <= (options.retry ? maxAttempts : 1); attempt += 1) {
    const timeoutSignal = AbortSignal.timeout(timeout);
    const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
    let response: Response;
    try {
      response = await fetch(`${settings.apiUrl}${path}`, {
        method: options.method ?? "GET",
        headers: {
          Authorization: settings.apiKey,
          ...(options.json !== undefined ? { "Content-Type": "application/json" } : {})
        },
        ...(options.json !== undefined ? { body: JSON.stringify(options.json) } : {}),
        ...(options.form ? { body: options.form } : {}),
        signal
      });
    } catch (error) {
      // A caller-initiated abort is not our failure to retry through.
      if (options.signal?.aborted) throw new PostizError("network", "Postiz request was cancelled");
      lastError = timeoutSignal.aborted
        ? new PostizError("timeout", `Postiz did not respond within ${Math.round(timeout / 1000)}s`)
        : new PostizError("network", error instanceof Error ? error.message : "Could not reach Postiz");
      if (attempt < maxAttempts && options.retry) { await sleep(backoffMs(attempt)); continue; }
      throw lastError;
    }

    if (response.ok) return response;

    const error = classify(response.status, await readDetail(response));
    const suggested = response.status === 429 ? retryAfterMs(response.headers.get("retry-after")) : undefined;
    lastError = suggested === undefined ? error : new PostizError(error.kind, error.message, { status: error.status, retryAfterMs: suggested });
    if (!lastError.transient || !options.retry || attempt >= maxAttempts) throw lastError;
    const wait = backoffMs(attempt, suggested);
    if (wait > maxInlineWaitMs) throw lastError;
    await sleep(wait);
  }

  throw lastError ?? new PostizError("server", "Postiz request failed");
}

export async function postizJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await postizFetch(path, options);
  return await response.json().catch(() => null) as T;
}
