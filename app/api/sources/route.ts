import { NextRequest, NextResponse } from "next/server";
import { contentCategories, ContentCategory } from "@/config/feeds";
import { listSourceArticles } from "@/src/ingest/wordpress";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") as ContentCategory | null;
  if (category && contentCategories.includes(category)) {
    return NextResponse.json({ category, articles: await listSourceArticles(category) }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=900" } });
  }

  const [blog, news] = await Promise.all([listSourceArticles("blog"), listSourceArticles("news")]);
  return NextResponse.json({ blog, news }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=900" } });
}
