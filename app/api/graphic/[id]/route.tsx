import { NextRequest, NextResponse } from "next/server";
import { renderTemplateGraphic } from "@/src/design/og-graphic";
import { getPost } from "@/src/workspace/store";
import { freezePostGraphic, readFrozenGraphic } from "@/src/design/frozen-graphic";
import { savePost } from "@/src/workspace/store";
import { adjustmentsFromParams } from "@/src/design/graphic-adjustments";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return new NextResponse("Not found", { status: 404 });
  // The editor previews unsaved slider positions through the query string, so
  // a preview must bypass both the frozen artifact and the stored adjustments.
  const preview = adjustmentsFromParams(request.nextUrl.searchParams);
  const adjustments = preview ?? post.graphicAdjustments;
  if (!preview && post.frozenGraphicPath) {
    try {
      return new NextResponse(await readFrozenGraphic(post.frozenGraphicPath), { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
    } catch {
      // Rebuild a missing local artifact below.
    }
  }
  if (!preview && post.status === "APPROVED") {
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
      graphicGuidance: post.graphicGuidance,
      sourceImageHasText: post.sourceImageHasText,
      adjustments
    });
  } catch (error) {
    console.warn(`Graphic render failed for ${id}; retrying without the source image:`, error instanceof Error ? error.message : error);
  }
  try {
    // Retrying with the same image would just fail the same way, so drop the
    // photo entirely: a branded text-only card beats a broken feed tile.
    return await renderTemplateGraphic({ topicHeading: post.topicHeading, articleTitle: post.articleTitle, graphicGuidance: post.graphicGuidance, sourceImageHasText: post.sourceImageHasText, adjustments });
  } catch (error) {
    return new NextResponse(`Graphic unavailable: ${error instanceof Error ? error.message : "render failed"}`, { status: 500 });
  }
}
