import { NextRequest, NextResponse } from "next/server";
import { contentCategories, ContentCategory } from "@/config/feeds";
import { listSourceArticles } from "@/src/ingest/wordpress";
import { readSourceCache } from "@/src/ingest/source-cache";
import { listPipelineSourceUrls } from "@/src/workspace/store";

/**
 * Serves the stored feeds. This never refreshes from the source sites - that is
 * what POST /api/sources/refresh is for.
 */
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") as ContentCategory | null;
  if (category && contentCategories.includes(category)) {
    try {
      return NextResponse.json({ category, articles: await listSourceArticles(category) }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return NextResponse.json({ category, articles: [], error: error instanceof Error ? error.message : `Could not load ${category} sources` }, { status: 502 });
    }
  }

  const [blogResult, newsResult, pipelineResult] = await Promise.allSettled([listSourceArticles("blog"), listSourceArticles("news"), listPipelineSourceUrls()]);
  const cache = await readSourceCache();
  const errors: Partial<Record<ContentCategory, string>> = {};
  const blog = blogResult.status === "fulfilled" ? blogResult.value : (errors.blog = blogResult.reason instanceof Error ? blogResult.reason.message : "Could not load blog sources", []);
  const news = newsResult.status === "fulfilled" ? newsResult.value : (errors.news = newsResult.reason instanceof Error ? newsResult.reason.message : "Could not load news sources", []);
  const pipelineUrls = pipelineResult.status === "fulfilled" ? pipelineResult.value : [];
  // A refresh that failed leaves its reason on the cache entry; surface it so
  // the library can say the copy on screen is stale.
  for (const item of contentCategories) if (cache[item]?.error && !errors[item]) errors[item] = cache[item]!.error;

  return NextResponse.json({
    blog,
    news,
    pipelineUrls,
    errors,
    newUrls: contentCategories.flatMap((item) => cache[item]?.lastAdded ?? []),
    updatedAt: contentCategories.map((item) => cache[item]?.fetchedAt).filter(Boolean).sort().pop()
  }, { status: Object.keys(errors).length === 2 ? 502 : 200, headers: { "Cache-Control": "no-store" } });
}
