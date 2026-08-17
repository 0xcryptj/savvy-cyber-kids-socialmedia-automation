import { assertTransition, PostStatus } from "./state";
export function approve(status: PostStatus): PostStatus { assertTransition(status, "APPROVED"); return "APPROVED"; }
export function reject(status: PostStatus): PostStatus { assertTransition(status, "REJECTED"); return "REJECTED"; }
export function requestRevision(status: PostStatus): PostStatus { assertTransition(status, "REVISION"); return "REVISION"; }
