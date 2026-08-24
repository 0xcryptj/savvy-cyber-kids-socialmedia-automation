import { NextRequest, NextResponse } from "next/server";
import { contentCategories, ContentCategory } from "@/config/feeds";
import { refreshSourceArticles } from "@/src/ingest/wordpress";
import { readSourceCache } from "@/src/ingest/source-cache";
import { listPipelineSourceUrls } from "@/src/workspace/store";
import { sameOrigin } from "@/src/lib/request-security";

/**
 * The only path that reaches out to the source sites on purpose. Everything
 * else in the app reads the stored copy, so updates happen when a human asks
 * for them rather than on a timer.
 */
export async function POST(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;

  const requested = request.nextUrl.searchParams.get("category") as ContentCategory | null;
  const categories = requested && contentCategories.includes(requested) ? [requested] : [...contentCategories];

  // Sequential on purpose: two feeds off one WordPress host, hit politely.
  const results = [];
  for (const category of categories) results.push(await refreshSourceArticles(category));

  const cache = await readSourceCache();
  const pipelineUrls = await listPipelineSourceUrls();
  const failed = results.filter((result) => result.error);

  return NextResponse.json({
    results,
    added: results.reduce((total, result) => total + result.added.length, 0),
    blog: cache.blog?.articles ?? [],
    news: cache.news?.articles ?? [],
    newUrls: results.flatMap((result) => result.added),
    pipelineUrls,
    updatedAt: results.map((result) => result.fetchedAt).sort().pop(),
    errors: Object.fromEntries(failed.map((result) => [result.category, result.error]))
  }, { status: failed.length === categories.length ? 502 : 200, headers: { "Cache-Control": "no-store" } });
}
