import { NextRequest, NextResponse } from "next/server";
import { contentCategories, ContentCategory } from "@/config/feeds";
import { listSourceArticles } from "@/src/ingest/wordpress";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") as ContentCategory | null;
  if (category && contentCategories.includes(category)) {
    try {
      return NextResponse.json({ category, articles: await listSourceArticles(category) }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=900" } });
    } catch (error) {
      return NextResponse.json({ category, articles: [], error: error instanceof Error ? error.message : `Could not load ${category} sources` }, { status: 502 });
    }
  }

  const [blogResult, newsResult] = await Promise.allSettled([listSourceArticles("blog"), listSourceArticles("news")]);
  const errors: Partial<Record<ContentCategory, string>> = {};
  const blog = blogResult.status === "fulfilled" ? blogResult.value : (errors.blog = blogResult.reason instanceof Error ? blogResult.reason.message : "Could not load blog sources", []);
  const news = newsResult.status === "fulfilled" ? newsResult.value : (errors.news = newsResult.reason instanceof Error ? newsResult.reason.message : "Could not load news sources", []);
  return NextResponse.json({ blog, news, errors }, { status: Object.keys(errors).length === 2 ? 502 : 200, headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=900" } });
}
