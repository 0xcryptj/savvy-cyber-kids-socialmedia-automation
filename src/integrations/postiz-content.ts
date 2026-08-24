import { createHash } from "crypto";
import { WorkspacePost } from "@/src/workspace/types";

// Re-exported so server-side callers keep one import for Postiz content, while
// the browser pulls the same function without dragging Node's crypto along.
export { composePostContent } from "@/src/content/post-text";

/**
 * Identifies the rendered graphic alone, so an edit that only touches the
 * caption still reuses the image already uploaded to Postiz.
 */
export function graphicFingerprint(post: WorkspacePost): string {
  return createHash("sha256").update(JSON.stringify({
    heading: post.topicHeading,
    title: post.articleTitle,
    image: post.generatedImageUrl || post.featuredImageUrl || null,
    guidance: post.graphicGuidance ?? null,
    hasText: post.sourceImageHasText ?? null,
    adjustments: post.graphicAdjustments ?? null,
    frozen: post.frozenGraphicPath ?? null
  })).digest("hex").slice(0, 32);
}
