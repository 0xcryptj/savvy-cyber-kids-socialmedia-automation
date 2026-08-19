import { describe, expect, it } from "vitest";
import { dedupePosts } from "@/src/workspace/store";
import { WorkspacePost } from "@/src/workspace/types";

function post(id: string, status: WorkspacePost["status"], createdAt: string): WorkspacePost {
  return {
    id,
    articleId: id,
    category: "blog",
    status,
    topicHeading: "ONLINE SAFETY",
    articleTitle: "Same source",
    caption: "Caption",
    hashtags: ["#one", "#two", "#savvycyberkids", "#cyberhero"],
    sourceUrl: "https://example.com/article",
    graphicPath: `/api/graphic/${id}`,
    publishedAt: createdAt,
    createdAt
  };
}

describe("workspace state", () => {
  it("keeps the newest item per source and status", () => {
    const result = dedupePosts([
      post("old", "PENDING_REVIEW", "2026-01-01T00:00:00.000Z"),
      post("new", "PENDING_REVIEW", "2026-01-02T00:00:00.000Z"),
      post("rejected", "REJECTED", "2026-01-03T00:00:00.000Z")
    ]);
    expect(result.map((item) => item.id)).toEqual(["rejected", "new"]);
  });

  it("normalizes legacy graphic cache-busting query strings", () => {
    const legacy = { ...post("legacy", "PENDING_REVIEW", "2026-01-04T00:00:00.000Z"), graphicPath: "/api/graphic/legacy?v=123" };
    expect(dedupePosts([legacy])[0].graphicPath).toBe("/api/graphic/legacy");
  });
});
