import { describe, expect, it } from "vitest";
import { contentRules } from "@/config/content-rules";
import { finalizeGeneratedPost } from "@/src/content/generate";
import { createLocalPost } from "@/src/content/local-copy";
import { validateEditableHashtags, validateGeneratedPost } from "@/src/content/validate";

describe("social content rules", () => {
  it("creates exactly four hashtags with both fixed tags", () => { const post = finalizeGeneratedPost(createLocalPost({ id: "article", category: "blog", sourceUrl: "https://example.com", canonicalUrl: "https://example.com", title: "Exact title", excerpt: "Caption", body: "Caption", tags: [], publishedAt: new Date().toISOString() })); expect(post.hashtags).toHaveLength(4); expect(post.hashtags).toEqual(expect.arrayContaining([...contentRules.hashtags.required])); });
  it("requires exactly two model-generated topical hashtags", () => { expect(() => validateGeneratedPost({ topic_heading: "TOPIC", article_title: "Title", caption: "Caption", hashtags: ["#one"] }, "Title")).toThrow(); });
  it("preserves the original article title", () => { expect(() => validateGeneratedPost({ topic_heading: "TOPIC", article_title: "Changed", caption: "Caption", hashtags: ["#one", "#two"] }, "Original")).toThrow(); });
  it("allows editable hashtags while retaining the required tags", () => {
    expect(validateEditableHashtags(["#privacy", "#familytech", "#savvycyberkids", "#cyberhero"])).toEqual(["#privacy", "#familytech", "#savvycyberkids", "#cyberhero"]);
    expect(() => validateEditableHashtags(["#privacy", "#familytech", "#one", "#two"])).toThrow();
  });
});
