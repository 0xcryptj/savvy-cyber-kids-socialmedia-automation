export const PostStatus = {
  DISCOVERED: "DISCOVERED",
  GENERATING: "GENERATING",
  PENDING_REVIEW: "PENDING_REVIEW",
  REVISION: "REVISION",
  REJECTED: "REJECTED",
  APPROVED: "APPROVED",
  QUEUED: "QUEUED",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED"
} as const;

export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

const transitions: Record<PostStatus, readonly PostStatus[]> = {
  DISCOVERED: ["GENERATING", "FAILED"], GENERATING: ["PENDING_REVIEW", "FAILED"],
  PENDING_REVIEW: ["REVISION", "REJECTED", "APPROVED", "FAILED"], REVISION: ["PENDING_REVIEW", "FAILED"],
  REJECTED: [], APPROVED: ["QUEUED", "FAILED"], QUEUED: ["SCHEDULED", "FAILED"],
  SCHEDULED: ["PUBLISHED", "FAILED"], PUBLISHED: [], FAILED: ["DISCOVERED", "GENERATING", "QUEUED"]
};

export function canTransition(from: PostStatus, to: PostStatus): boolean { return transitions[from].includes(to); }
export function assertTransition(from: PostStatus, to: PostStatus): void {
  if (!canTransition(from, to)) throw new Error(`Invalid post transition: ${from} -> ${to}`);
}
