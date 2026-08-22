import { assertTransition, PostStatus } from "./state";
import { getPost, recordFeedback, savePost, rememberApprovedLayout } from "@/src/workspace/store";
import { layoutKey } from "@/src/design/layout-memory";
import { WorkspacePost } from "@/src/workspace/types";
import { freezePostGraphic } from "@/src/design/frozen-graphic";

export function approve(status: PostStatus): PostStatus {
  assertTransition(status, "APPROVED");
  return "APPROVED";
}

export function reject(status: PostStatus): PostStatus {
  assertTransition(status, "REJECTED");
  return "REJECTED";
}

export function requestRevision(status: PostStatus): PostStatus {
  assertTransition(status, "REVISION");
  return "REVISION";
}

const stamps: Partial<Record<PostStatus, keyof WorkspacePost>> = {
  APPROVED: "approvedAt",
  QUEUED: "queuedAt",
  SCHEDULED: "scheduledAt",
  PUBLISHED: "publishedAt"
};

export async function transitionPost(id: string, next: PostStatus, patch?: Partial<WorkspacePost>, feedbackNote?: string): Promise<WorkspacePost> {
  const post = await getPost(id);
  if (!post) throw new Error("Post not found");
  if (post.status === next) return savePost({ ...post, ...patch });
  assertTransition(post.status, next);
  const stamp = stamps[next];
  const failureReason = next === "FAILED" ? patch?.failureReason || "Workflow failed before completion." : undefined;
  const stampValue = stamp ? patch?.[stamp] || new Date().toISOString() : undefined;
  let updated = {
    ...post,
    ...patch,
    status: next,
    ...(failureReason ? { failureReason } : {}),
    ...(stamp && stampValue ? { [stamp]: stampValue } : {})
  };
  if (next === "APPROVED") {
    updated = { ...updated, frozenGraphicPath: await freezePostGraphic(updated) };
  }
  if (next === "PENDING_REVIEW" && (post.status === "APPROVED" || post.status === "QUEUED")) {
    // Drop the frozen artifact and the pipeline stamps so the post behaves like
    // a fresh review item. Any note the reviewer gave for sending it back also
    // becomes graphic guidance, so the preview reflects the reason immediately.
    const note = feedbackNote?.trim();
    updated = {
      ...updated,
      frozenGraphicPath: undefined,
      approvedAt: undefined,
      queuedAt: undefined,
      ...(note ? { graphicGuidance: note.slice(0, 1000) } : {})
    };
  }
  updated = await savePost(updated);
  if (next === "APPROVED" && updated.graphicAdjustments) {
    // Approving a hand-adjusted graphic is the signal that the layout is good.
    const key = layoutKey(updated);
    if (key) await rememberApprovedLayout(key, updated.graphicAdjustments);
  }
  if (next === "APPROVED" || next === "REJECTED") await recordFeedback({ postId: updated.id, category: updated.category, status: next, topicHeading: updated.topicHeading, articleTitle: updated.articleTitle, note: feedbackNote?.trim() || undefined, createdAt: new Date().toISOString() });
  return updated;
}
