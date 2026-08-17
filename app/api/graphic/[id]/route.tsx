import { NextRequest, NextResponse } from "next/server";
import { renderTemplateGraphic } from "@/src/design/og-graphic";
import { getPost } from "@/src/workspace/store";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return new NextResponse("Not found", { status: 404 });
  return renderTemplateGraphic({
    topicHeading: post.topicHeading,
    articleTitle: post.articleTitle,
    imageUrl: post.featuredImageUrl
  });
}
