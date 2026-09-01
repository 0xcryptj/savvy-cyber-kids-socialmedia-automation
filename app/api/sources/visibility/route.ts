import { NextRequest, NextResponse } from "next/server";
import { contentCategories, ContentCategory } from "@/config/feeds";
import { setArticleHidden } from "@/src/ingest/source-cache";
import { sameOrigin } from "@/src/lib/request-security";

export async function PATCH(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const body = await request.json().catch(() => null) as { category?: unknown; canonicalUrl?: unknown; hidden?: unknown } | null;
  if (!contentCategories.includes(body?.category as ContentCategory) || typeof body?.canonicalUrl !== "string" || body.canonicalUrl.length > 2048 || typeof body.hidden !== "boolean") {
    return NextResponse.json({ error: "Invalid article visibility request" }, { status: 400 });
  }
  const category = body.category as ContentCategory;
  try {
    return NextResponse.json({ category, articles: await setArticleHidden(category, body.canonicalUrl, body.hidden) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update article visibility" }, { status: 404 });
  }
}
