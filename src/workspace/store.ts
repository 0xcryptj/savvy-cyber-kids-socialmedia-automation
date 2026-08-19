import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
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

function postKey(post: WorkspacePost): string {
  return `${post.status}:${post.externalUrl || post.sourceUrl}`;
}

function normalizePost(post: WorkspacePost): WorkspacePost {
  return post.graphicPath.startsWith("/api/graphic/")
    ? { ...post, graphicPath: post.graphicPath.split("?", 1)[0] }
    : post;
}

export function dedupePosts(posts: WorkspacePost[]): WorkspacePost[] {
  const seen = new Set<string>();
  return [...posts]
    .map(normalizePost)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((post) => {
      const key = postKey(post);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function writeState(state: WorkspaceState): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2));
}

export async function listPosts(status?: PostStatus): Promise<WorkspacePost[]> {
  const { posts } = await readState();
  const current = dedupePosts(posts);
  return status ? current.filter((post) => post.status === status) : current;
}

export async function getPost(id: string): Promise<WorkspacePost | undefined> {
  const { posts } = await readState();
  const post = posts.find((item) => item.id === id);
  return post ? normalizePost(post) : undefined;
}

export async function findPostByCanonicalUrl(url: string): Promise<WorkspacePost | undefined> {
  const { posts } = await readState();
  return posts.find((post) => post.sourceUrl === url || post.externalUrl === url);
}

export async function savePost(post: WorkspacePost): Promise<WorkspacePost> {
  post = normalizePost(post);
  const state = await readState();
  const index = state.posts.findIndex((item) => item.id === post.id);
  if (index >= 0) state.posts[index] = post;
  else state.posts.unshift(post);
  await writeState(state);
  return post;
}

export async function countsByStatus(): Promise<Record<string, number>> {
  const { posts } = await readState();
  const current = dedupePosts(posts);
  return current.reduce<Record<string, number>>((counts, post) => {
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
