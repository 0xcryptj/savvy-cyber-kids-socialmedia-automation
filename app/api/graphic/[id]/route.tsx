import { NextRequest, NextResponse } from "next/server";
import { renderTemplateGraphic } from "@/src/design/og-graphic";
import { getPost } from "@/src/workspace/store";
import { freezePostGraphic, readFrozenGraphic } from "@/src/design/frozen-graphic";
import { savePost } from "@/src/workspace/store";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return new NextResponse("Not found", { status: 404 });
  if (post.frozenGraphicPath) {
    try {
      return new NextResponse(await readFrozenGraphic(post.frozenGraphicPath), { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
    } catch {
      // Rebuild a missing local artifact below.
    }
  }
  if (post.status === "APPROVED") {
    try {
      const frozenGraphicPath = await freezePostGraphic(post);
      await savePost({ ...post, frozenGraphicPath });
      return new NextResponse(await readFrozenGraphic(frozenGraphicPath), { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
    } catch {
      // Fall through to the live renderer so an approved post remains viewable.
    }
  }
  try {
    return await renderTemplateGraphic({
      topicHeading: post.topicHeading,
      articleTitle: post.articleTitle,
      imageUrl: post.generatedImageUrl || post.featuredImageUrl,
      graphicGuidance: post.graphicGuidance
    });
  } catch {
    // A bad third-party image must not take down the whole graphic route.
    return renderTemplateGraphic({ topicHeading: post.topicHeading, articleTitle: post.articleTitle, imageUrl: post.featuredImageUrl, graphicGuidance: post.graphicGuidance });
  }
}
