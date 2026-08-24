import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { ContentCategory, contentCategories } from "@/config/feeds";
import { SourceArticle } from "./types";

/**
 * The last known state of each feed, kept on disk.
 *
 * Both feeds belong to someone else's WordPress site, and re-fetching them on
 * every page view is traffic they did not ask for. Reads come from here; the
 * network is only touched when a human presses Update sources, or when the
 * cache has nothing to serve.
 */
export type SourceCacheEntry = {
  articles: SourceArticle[];
  fetchedAt: string;
  /** Canonical URLs that appeared in the most recent refresh. */
  lastAdded: string[];
  /** Why the last refresh failed, if it did. The articles above still stand. */
  error?: string;
};

export type SourceCache = Partial<Record<ContentCategory, SourceCacheEntry>>;

function cachePath(): string {
  return process.env.SOURCE_CACHE_PATH || path.join(process.cwd(), "storage/source-cache.json");
}

export async function readSourceCache(): Promise<SourceCache> {
  try {
    const parsed = JSON.parse(await readFile(cachePath(), "utf8")) as SourceCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function readCachedCategory(category: ContentCategory): Promise<SourceCacheEntry | undefined> {
  return (await readSourceCache())[category];
}

async function writeSourceCache(cache: SourceCache): Promise<void> {
  const target = cachePath();
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(cache, null, 2));
}

/** Canonical URLs already in the cache, used to work out what a refresh brought in. */
function knownUrls(entry: SourceCacheEntry | undefined): Set<string> {
  return new Set((entry?.articles ?? []).map((article) => article.canonicalUrl));
}

export type RefreshResult = { category: ContentCategory; total: number; added: string[]; fetchedAt: string; error?: string };

export async function storeRefreshedArticles(category: ContentCategory, articles: SourceArticle[]): Promise<RefreshResult> {
  const cache = await readSourceCache();
  const previous = cache[category];
  // A cold cache is not "all new" - that would flag the whole feed on first run.
  const added = previous ? articles.map((article) => article.canonicalUrl).filter((url) => !knownUrls(previous).has(url)) : [];
  const fetchedAt = new Date().toISOString();
  await writeSourceCache({ ...cache, [category]: { articles, fetchedAt, lastAdded: added } });
  return { category, total: articles.length, added, fetchedAt };
}

/**
 * Records a failed refresh without discarding what we already have: a feed
 * being down is no reason to empty the library.
 */
export async function storeRefreshFailure(category: ContentCategory, message: string): Promise<RefreshResult> {
  const cache = await readSourceCache();
  const previous = cache[category];
  const fetchedAt = new Date().toISOString();
  await writeSourceCache({ ...cache, [category]: { articles: previous?.articles ?? [], fetchedAt: previous?.fetchedAt ?? fetchedAt, lastAdded: previous?.lastAdded ?? [], error: message } });
  return { category, total: previous?.articles.length ?? 0, added: [], fetchedAt: previous?.fetchedAt ?? fetchedAt, error: message };
}

/** Newest fetch time across the feeds, for the "updated N ago" label. */
export async function sourcesLastUpdatedAt(): Promise<string | undefined> {
  const cache = await readSourceCache();
  const stamps = contentCategories.map((category) => cache[category]?.fetchedAt).filter((stamp): stamp is string => Boolean(stamp)).sort();
  return stamps[stamps.length - 1];
}
