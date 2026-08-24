import type { WorkspacePost } from "@/src/workspace/types";

/**
 * The exact text handed to Postiz.
 *
 * Kept free of Node-only imports so the queue can call it in the browser to
 * show a live character count against the same string the export will send.
 */
export function composePostContent(post: Pick<WorkspacePost, "caption" | "hashtags">): string {
  const caption = post.caption.trim();
  const hashtags = post.hashtags.filter((tag) => tag.trim()).join(" ").trim();
  return hashtags ? `${caption}\n\n${hashtags}`.trim() : caption;
}
