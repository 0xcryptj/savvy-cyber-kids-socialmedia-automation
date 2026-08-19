import { assertTransition, PostStatus } from "./state";
import { getPost, recordFeedback, savePost } from "@/src/workspace/store";
import { WorkspacePost } from "@/src/workspace/types";

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
  const updated = await savePost({
    ...post,
    ...patch,
    status: next,
    ...(failureReason ? { failureReason } : {}),
    ...(stamp ? { [stamp]: new Date().toISOString() } : {})
  });
  if (next === "APPROVED" || next === "REJECTED") await recordFeedback({ postId: updated.id, category: updated.category, status: next, topicHeading: updated.topicHeading, articleTitle: updated.articleTitle, note: feedbackNote?.trim() || undefined, createdAt: new Date().toISOString() });
  return updated;
}
