import { describe, expect, it } from "vitest";
import { contentRules } from "@/config/content-rules";
import { createMockPost, finalizeGeneratedPost } from "@/src/content/generate";
import { validateGeneratedPost } from "@/src/content/validate";

describe("social content rules", () => {
  it("creates exactly four hashtags with both fixed tags", () => { const post = finalizeGeneratedPost(createMockPost("Exact title")); expect(post.hashtags).toHaveLength(4); expect(post.hashtags).toEqual(expect.arrayContaining([...contentRules.hashtags.required])); });
  it("requires exactly two model-generated topical hashtags", () => { expect(() => validateGeneratedPost({ topic_heading: "TOPIC", article_title: "Title", caption: "Caption", hashtags: ["#one"] }, "Title")).toThrow(); });
  it("preserves the original article title", () => { expect(() => validateGeneratedPost({ topic_heading: "TOPIC", article_title: "Changed", caption: "Caption", hashtags: ["#one", "#two"] }, "Original")).toThrow(); });
});
