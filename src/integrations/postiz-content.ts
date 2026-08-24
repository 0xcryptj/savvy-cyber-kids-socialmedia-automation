import { createHash } from "crypto";
import { WorkspacePost } from "@/src/workspace/types";

/**
 * The exact text handed to Postiz. Preflight and export both call this so the
 * length a reviewer is warned about is the length that actually gets posted.
 */
export function composePostContent(post: WorkspacePost): string {
  const caption = post.caption.trim();
  const hashtags = post.hashtags.filter((tag) => tag.trim()).join(" ").trim();
  return hashtags ? `${caption}\n\n${hashtags}`.trim() : caption;
}

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
