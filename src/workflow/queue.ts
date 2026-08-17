import { assertTransition, PostStatus } from "./state";
export function queueApproved(status: PostStatus): PostStatus { assertTransition(status, "QUEUED"); return "QUEUED"; }
