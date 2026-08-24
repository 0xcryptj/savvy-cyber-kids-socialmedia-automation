import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { SourceArticle } from "@/src/ingest/types";
import {
  readCachedCategory,
  sourcesLastUpdatedAt,
  storeRefreshFailure,
  storeRefreshedArticles
} from "@/src/ingest/source-cache";
import { listSourceArticles } from "@/src/ingest/wordpress";

function article(id: string, url: string): SourceArticle {
  return {
    id, category: "blog", sourceUrl: url, canonicalUrl: url,
    title: `Article ${id}`, excerpt: "Excerpt", body: "Body",
    tags: [], publishedAt: "2026-01-01T00:00:00.000Z"
  };
}

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "source-cache-"));
  process.env.SOURCE_CACHE_PATH = path.join(directory, "sources.json");
});

afterEach(async () => {
  delete process.env.SOURCE_CACHE_PATH;
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});

describe("source cache", () => {
  it("does not flag the whole feed as new on the first fetch", async () => {
    const result = await storeRefreshedArticles("blog", [article("1", "https://x.test/1"), article("2", "https://x.test/2")]);
    expect(result.added).toEqual([]);
    expect(result.total).toBe(2);
  });

  it("reports only what arrived since the last update", async () => {
    await storeRefreshedArticles("blog", [article("1", "https://x.test/1")]);
    const second = await storeRefreshedArticles("blog", [article("2", "https://x.test/2"), article("1", "https://x.test/1")]);
    expect(second.added).toEqual(["https://x.test/2"]);
  });

  it("reports nothing new when the feed is unchanged", async () => {
    await storeRefreshedArticles("blog", [article("1", "https://x.test/1")]);
    expect((await storeRefreshedArticles("blog", [article("1", "https://x.test/1")])).added).toEqual([]);
  });

  it("keeps the stored articles when an update fails", async () => {
    await storeRefreshedArticles("blog", [article("1", "https://x.test/1")]);
    const failure = await storeRefreshFailure("blog", "Feed timed out");
    expect(failure.error).toBe("Feed timed out");
    expect(failure.total).toBe(1);
    const entry = await readCachedCategory("blog");
    expect(entry?.articles).toHaveLength(1);
    expect(entry?.error).toBe("Feed timed out");
  });

  it("tracks the newest update across both feeds", async () => {
    await storeRefreshedArticles("blog", [article("1", "https://x.test/1")]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await storeRefreshedArticles("news", [article("2", "https://y.test/2")]);
    const newest = await sourcesLastUpdatedAt();
    expect(newest).toBe((await readCachedCategory("news"))?.fetchedAt);
  });

  it("clears a previous error once an update succeeds", async () => {
    await storeRefreshedArticles("blog", [article("1", "https://x.test/1")]);
    await storeRefreshFailure("blog", "Feed timed out");
    await storeRefreshedArticles("blog", [article("1", "https://x.test/1")]);
    expect((await readCachedCategory("blog"))?.error).toBeUndefined();
  });
});

describe("reading sources", () => {
  it("serves the stored feed without contacting the source site", async () => {
    await storeRefreshedArticles("blog", [article("1", "https://x.test/1")]);
    // The whole point of the cache: browsing the library costs them no traffic.
    const spy = vi.spyOn(globalThis, "fetch");
    const articles = await listSourceArticles("blog");
    expect(articles).toHaveLength(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it("writes what it fetched so the next read stays local", async () => {
    const payload = JSON.stringify({ blog: { articles: [article("9", "https://x.test/9")], fetchedAt: "2026-01-01T00:00:00.000Z", lastAdded: [] } });
    await writeFile(process.env.SOURCE_CACHE_PATH!, payload);
    const spy = vi.spyOn(globalThis, "fetch");
    await listSourceArticles("blog");
    expect(spy).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(process.env.SOURCE_CACHE_PATH!, "utf8")).blog.articles).toHaveLength(1);
  });
});
