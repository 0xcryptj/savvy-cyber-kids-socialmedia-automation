import { assertTransition, PostStatus } from "./state";
import { getPost, savePost } from "@/src/workspace/store";
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

export async function transitionPost(id: string, next: PostStatus, patch?: Partial<WorkspacePost>): Promise<WorkspacePost> {
  const post = await getPost(id);
  if (!post) throw new Error("Post not found");
  assertTransition(post.status, next);
  const stamp = stamps[next];
  return savePost({
    ...post,
    ...patch,
    status: next,
    ...(stamp ? { [stamp]: new Date().toISOString() } : {})
  });
}
