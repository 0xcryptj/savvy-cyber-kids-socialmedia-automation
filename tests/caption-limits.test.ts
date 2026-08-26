import { describe, expect, it } from "vitest";
import { contentRules } from "@/config/content-rules";
import { captionBudget, fitCaption, fitsPlatformLimit, plannedCaptionBudget, strictestPlatformLimit } from "@/src/content/caption-limits";
import { composePostContent } from "@/src/content/post-text";
import { finalizeGeneratedPost } from "@/src/content/generate";
import { createLocalPost } from "@/src/content/local-copy";
import { SourceArticle } from "@/src/ingest/types";

const hashtags = ["#Privacy", "#FamilyTech", ...contentRules.hashtags.required];

function article(overrides: Partial<SourceArticle> = {}): SourceArticle {
  return {
    id: "article",
    category: "blog",
    sourceUrl: "https://savvycyberkids.org/a-fairly-long-article-slug-here",
    canonicalUrl: "https://savvycyberkids.org/a-fairly-long-article-slug-here",
    title: "Teaching kids to spot a scam before it costs them",
    excerpt: "Scammers now target children directly through games and chat apps.",
    body: "Scammers now target children directly through games and chat apps. Parents who talk about it early give their kids a script to fall back on. That conversation matters more than any filter, because the pitch arrives in places no filter reaches. Families that practise the answer out loud tend to catch it faster.",
    tags: [],
    publishedAt: new Date().toISOString(),
    ...overrides
  } as SourceArticle;
}

describe("caption character limits", () => {
  it("leaves room for the hashtags that share the platform's limit", () => {
    const budget = captionBudget(hashtags);
    expect(budget).toBeLessThan(strictestPlatformLimit);
    expect(composePostContent({ caption: "x".repeat(budget), hashtags })).toHaveLength(strictestPlatformLimit);
  });

  it("plans for the longest hashtags the prompt permits", () => {
    const longest = Array.from({ length: contentRules.hashtags.generated }, () => "#".padEnd(contentRules.caption.maxHashtagLength, "z"));
    expect(fitsPlatformLimit("x".repeat(plannedCaptionBudget()), [...longest, ...contentRules.hashtags.required])).toBe(true);
  });

  it("cuts an over-long caption at a sentence boundary", () => {
    const caption = `${"Talk to your kids about scams before the scammers do. ".repeat(4)}One more thought.`;
    const fitted = fitCaption(caption, hashtags);
    expect(fitsPlatformLimit(fitted, hashtags)).toBe(true);
    expect(fitted.endsWith(".")).toBe(true);
    expect(caption.startsWith(fitted)).toBe(true);
  });

  it("keeps the article link when it trims", () => {
    const link = "https://savvycyberkids.org/teaching-kids-to-spot-a-scam";
    const fitted = fitCaption(`${"Scammers target children in games and chat apps. ".repeat(5)}Read the full article: ${link}`, hashtags);
    expect(fitsPlatformLimit(fitted, hashtags)).toBe(true);
    expect(fitted.endsWith(link)).toBe(true);
  });

  it("falls back to a word boundary when no sentence ends in range", () => {
    const fitted = fitCaption(`${"word ".repeat(200)}end.`, hashtags);
    expect(fitsPlatformLimit(fitted, hashtags)).toBe(true);
    expect(fitted).toMatch(/word…$/);
  });

  it("leaves a caption that already fits exactly as written", () => {
    const caption = "Talk to your kids about scams before the scammers do.";
    expect(fitCaption(caption, hashtags)).toBe(caption);
  });

  it("keeps generated posts inside the limit even when the model overruns", () => {
    const post = finalizeGeneratedPost({
      topic_heading: "PRIVACY",
      article_title: "Exact title",
      caption: "This caption ignores the brief entirely. ".repeat(20),
      hashtags: ["#Privacy", "#FamilyTech"]
    });
    expect(fitsPlatformLimit(post.caption, post.hashtags)).toBe(true);
  });

  it("keeps the offline fallback caption inside the limit", () => {
    for (const category of ["blog", "news"] as const) {
      const post = finalizeGeneratedPost(createLocalPost(article({ category })));
      expect(composePostContent(post).length).toBeLessThanOrEqual(strictestPlatformLimit);
      expect(post.caption).toContain("https://");
    }
  });
});
