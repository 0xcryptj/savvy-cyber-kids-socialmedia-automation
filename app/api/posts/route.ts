import { NextRequest, NextResponse } from "next/server";
import { contentCategories, ContentCategory } from "@/config/feeds";
import { processArticle } from "@/src/workflow/processArticle";
import { listPosts } from "@/src/workspace/store";
import { boundedText, sameOrigin } from "@/src/lib/request-security";
import { sourceArticleSchema } from "@/src/ingest/types";

export async function GET() {
  return NextResponse.json({ posts: await listPosts() });
}

export async function POST(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const body = await request.json() as { canonicalUrl?: unknown; category?: ContentCategory; sourceArticle?: unknown };
  const canonicalUrl = boundedText(body.canonicalUrl, 2048);
  if (!canonicalUrl || !body.category || !contentCategories.includes(body.category)) {
    return NextResponse.json({ error: "canonicalUrl and category are required" }, { status: 400 });
  }
  const parsedArticle = body.sourceArticle === undefined ? undefined : sourceArticleSchema.safeParse(body.sourceArticle);
  if (parsedArticle && !parsedArticle.success) return NextResponse.json({ error: "The selected source article is invalid" }, { status: 400 });
  if (parsedArticle?.success && (parsedArticle.data.category !== body.category || (parsedArticle.data.canonicalUrl !== canonicalUrl && parsedArticle.data.sourceUrl !== canonicalUrl))) {
    return NextResponse.json({ error: "The selected source article does not match the requested feed item" }, { status: 400 });
  }
  try {
    const post = await processArticle({ canonicalUrl, category: body.category, sourceArticle: parsedArticle?.success ? parsedArticle.data : undefined });
    return NextResponse.json(post);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create post" }, { status: 400 });
  }
}
