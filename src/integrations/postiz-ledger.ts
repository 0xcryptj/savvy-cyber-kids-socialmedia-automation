import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { WorkspacePost } from "@/src/workspace/types";

/**
 * A record of what this dashboard has actually handed to Postiz.
 *
 * Postiz has no idempotency key, so a create that succeeds on their side but
 * fails on ours - a dropped response, a crash between the call and the state
 * write, an impatient second click - would otherwise re-post to real social
 * accounts on retry. The ledger is the memory that makes export safe to repeat.
 */
export type PostizChannelResult = { integrationId: string; integrationName: string; postizPostId?: string };

export type PostizExportRecord = {
  postId: string;
  /** Content hash. A reviewer edit changes it, which re-opens export. */
  fingerprint: string;
  status: "exported" | "failed";
  exportedAt: string;
  integrationIds: string[];
  results: PostizChannelResult[];
  attempts: number;
  lastError?: string;
  /**
   * Set when a create failed in a way that leaves it genuinely unknown whether
   * Postiz accepted it - a timeout or dropped connection. Retrying blind could
   * double-post, so the dashboard asks the reviewer to check Postiz first.
   */
  uncertain?: boolean;
};

type MediaRecord = { fingerprint: string; id: string; path: string; uploadedAt: string };

type LedgerState = {
  exports: PostizExportRecord[];
  media: MediaRecord[];
  /** ISO timestamps of create-post calls, for the rolling rate-limit window. */
  creates: string[];
};

/** Resolved per call so tests can point the ledger at a scratch file. */
function ledgerPath(): string {
  return process.env.POSTIZ_LEDGER_PATH || path.join(process.cwd(), "storage/postiz-exports.json");
}

async function readLedger(): Promise<LedgerState> {
  try {
    const parsed = JSON.parse(await readFile(ledgerPath(), "utf8")) as Partial<LedgerState>;
    return { exports: parsed.exports ?? [], media: parsed.media ?? [], creates: parsed.creates ?? [] };
  } catch {
    return { exports: [], media: [], creates: [] };
  }
}

async function writeLedger(state: LedgerState): Promise<void> {
  const target = ledgerPath();
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(state, null, 2));
}

/**
 * Everything that would change what a follower sees. Deliberately excludes the
 * schedule date: re-exporting the same content is a duplicate whether or not
 * the reviewer moved the time.
 */
export function contentFingerprint(post: WorkspacePost): string {
  return createHash("sha256").update(JSON.stringify({
    caption: post.caption.trim(),
    hashtags: post.hashtags,
    heading: post.topicHeading,
    title: post.articleTitle,
    graphic: post.frozenGraphicPath ?? null,
    image: post.generatedImageUrl || post.featuredImageUrl || null,
    adjustments: post.graphicAdjustments ?? null
  })).digest("hex").slice(0, 32);
}

export async function getExportRecord(postId: string): Promise<PostizExportRecord | undefined> {
  return (await readLedger()).exports.find((entry) => entry.postId === postId);
}

export async function listExportRecords(postIds?: string[]): Promise<PostizExportRecord[]> {
  const { exports } = await readLedger();
  return postIds ? exports.filter((entry) => postIds.includes(entry.postId)) : exports;
}

/**
 * True when this exact content already reached every requested channel, which
 * makes a repeat export a duplicate rather than a retry.
 */
export function alreadyExported(record: PostizExportRecord | undefined, fingerprint: string, integrationIds: string[]): boolean {
  if (!record || record.status !== "exported" || record.fingerprint !== fingerprint) return false;
  const delivered = new Set(record.results.filter((result) => result.postizPostId).map((result) => result.integrationId));
  return integrationIds.every((id) => delivered.has(id));
}

/** Channels from this request that this content has not reached yet. */
export function pendingIntegrations(record: PostizExportRecord | undefined, fingerprint: string, integrationIds: string[]): string[] {
  if (!record || record.fingerprint !== fingerprint) return integrationIds;
  const delivered = new Set(record.results.filter((result) => result.postizPostId).map((result) => result.integrationId));
  return integrationIds.filter((id) => !delivered.has(id));
}

export async function recordExport(entry: Omit<PostizExportRecord, "attempts"> & { attempts?: number }): Promise<PostizExportRecord> {
  const state = await readLedger();
  const index = state.exports.findIndex((existing) => existing.postId === entry.postId);
  const previous = index >= 0 ? state.exports[index] : undefined;
  // Results accumulate across attempts so a partial success is never re-sent.
  const merged = new Map<string, PostizChannelResult>();
  if (previous?.fingerprint === entry.fingerprint) {
    for (const result of previous.results) if (result.postizPostId) merged.set(result.integrationId, result);
  }
  for (const result of entry.results) merged.set(result.integrationId, result);

  const record: PostizExportRecord = {
    ...entry,
    results: [...merged.values()],
    attempts: (previous?.fingerprint === entry.fingerprint ? previous.attempts : 0) + (entry.attempts ?? 1)
  };
  if (index >= 0) state.exports[index] = record;
  else state.exports.unshift(record);
  await writeLedger({ ...state, exports: state.exports.slice(0, 500) });
  return record;
}

/** An upload already on Postiz for this exact graphic, so retries skip re-upload. */
export async function findMedia(fingerprint: string): Promise<MediaRecord | undefined> {
  return (await readLedger()).media.find((entry) => entry.fingerprint === fingerprint);
}

/**
 * Drops a cached upload Postiz will no longer accept.
 *
 * The media cache is keyed on the graphic alone, so a reference that has gone
 * stale on Postiz's side outlives every caption edit: without this, one bad
 * cache entry makes a post permanently unexportable and the reviewer sees the
 * same rejection no matter what they change.
 */
export async function forgetMedia(fingerprint: string): Promise<void> {
  const state = await readLedger();
  await writeLedger({ ...state, media: state.media.filter((entry) => entry.fingerprint !== fingerprint) });
}

export async function recordMedia(fingerprint: string, media: { id: string; path: string }): Promise<void> {
  const state = await readLedger();
  const media_ = state.media.filter((entry) => entry.fingerprint !== fingerprint);
  media_.unshift({ fingerprint, id: media.id, path: media.path, uploadedAt: new Date().toISOString() });
  await writeLedger({ ...state, media: media_.slice(0, 200) });
}

/**
 * Postiz caps create-post at 100/hour on cloud. Tracking our own calls lets a
 * bulk export stop short with an honest message instead of walking into a wall
 * of 429s halfway through and leaving the batch half-delivered.
 */
const createWindowMs = 60 * 60 * 1000;
/** Held just under the documented 100/hour so a burst never trips the limit. */
const createBudget = () => Number(process.env.POSTIZ_CREATE_BUDGET) || 90;

export async function createBudgetRemaining(): Promise<{ remaining: number; resetAt?: string }> {
  const { creates } = await readLedger();
  const cutoff = Date.now() - createWindowMs;
  const recent = creates.filter((stamp) => Date.parse(stamp) > cutoff).sort();
  const oldest = recent[0];
  return {
    remaining: Math.max(0, createBudget() - recent.length),
    resetAt: oldest ? new Date(Date.parse(oldest) + createWindowMs).toISOString() : undefined
  };
}

export async function recordCreate(): Promise<void> {
  const state = await readLedger();
  const cutoff = Date.now() - createWindowMs;
  await writeLedger({ ...state, creates: [...state.creates.filter((stamp) => Date.parse(stamp) > cutoff), new Date().toISOString()] });
}
