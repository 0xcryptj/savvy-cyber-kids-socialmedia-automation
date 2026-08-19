import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { revalidateTag, unstable_cache } from "next/cache";
import { PostStatus } from "@/src/workflow/state";
import { WorkspaceFeedback, WorkspacePost, WorkspaceState } from "./types";

const filePath = path.join(process.cwd(), "storage/workspace.json");

async function readState(): Promise<WorkspaceState> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as WorkspaceState;
  } catch {
    return { posts: [] };
  }
}

const readCachedState = unstable_cache(readState, ["workspace-state"], { revalidate: 5 });

async function writeState(state: WorkspaceState): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2));
  revalidateTag("workspace-state", "max");
}

export async function listPosts(status?: PostStatus): Promise<WorkspacePost[]> {
  const { posts } = await readCachedState();
  const sorted = [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return status ? sorted.filter((post) => post.status === status) : sorted;
}

export async function getPost(id: string): Promise<WorkspacePost | undefined> {
  const { posts } = await readCachedState();
  return posts.find((post) => post.id === id);
}

export async function findPostByCanonicalUrl(url: string): Promise<WorkspacePost | undefined> {
  const { posts } = await readCachedState();
  return posts.find((post) => post.sourceUrl === url || post.externalUrl === url);
}

export async function savePost(post: WorkspacePost): Promise<WorkspacePost> {
  const state = await readState();
  const index = state.posts.findIndex((item) => item.id === post.id);
  if (index >= 0) state.posts[index] = post;
  else state.posts.unshift(post);
  await writeState(state);
  return post;
}

export async function countsByStatus(): Promise<Record<string, number>> {
  const { posts } = await readCachedState();
  return posts.reduce<Record<string, number>>((counts, post) => {
    counts[post.status] = (counts[post.status] ?? 0) + 1;
    return counts;
  }, {});
}

export async function recordFeedback(feedback: WorkspaceFeedback): Promise<void> {
  const state = await readState();
  const entries = [...(state.feedback ?? []), feedback].slice(-100);
  await writeState({ ...state, feedback: entries });
}

export async function recentFeedback(category?: WorkspaceFeedback["category"]): Promise<WorkspaceFeedback[]> {
  const state = await readState();
  return (state.feedback ?? []).filter((item) => !category || item.category === category).slice(-12).reverse();
}
