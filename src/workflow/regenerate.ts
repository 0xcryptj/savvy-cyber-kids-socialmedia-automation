import { randomUUID } from "crypto";
import { ContentCategory } from "@/config/feeds";
import { generateSocialPost, finalizeGeneratedPost } from "@/src/content/generate";
import { findSourceArticle, hydrateArticle } from "@/src/ingest/wordpress";
import { SourceArticle } from "@/src/ingest/types";
import { getPost, savePost } from "@/src/workspace/store";
import { WorkspacePost } from "@/src/workspace/types";
import { boundedText } from "@/src/lib/request-security";

function fallbackArticle(post: WorkspacePost): SourceArticle {
  return {
    id: post.articleId,
    category: post.category,
    sourceType: "manual_url",
    sourceUrl: post.sourceUrl,
    canonicalUrl: post.sourceUrl,
    externalUrl: post.externalUrl,
    title: post.articleTitle,
    excerpt: post.caption,
    body: post.caption,
    featuredImageUrl: post.featuredImageUrl,
    tags: [],
    publishedAt: post.publishedAt
  };
}

export async function regeneratePost(id: string, reviewerGuidance?: string): Promise<WorkspacePost> {
  const previous = await getPost(id);
  if (!previous) throw new Error("Post not found");

  let article = fallbackArticle(previous);
  try {
    const refreshed = await findSourceArticle(previous.category as ContentCategory, previous.externalUrl || previous.sourceUrl);
    if (refreshed) article = await hydrateArticle(refreshed);
  } catch {
    // Regeneration remains available when the source feed is temporarily down.
  }

  const generated = finalizeGeneratedPost(await generateSocialPost(article, boundedText(reviewerGuidance, 1000)));
  const nextId = `post_${randomUUID().slice(0, 8)}`;
  return savePost({
    ...previous,
    id: nextId,
    status: "PENDING_REVIEW",
    topicHeading: generated.topic_heading,
    articleTitle: generated.article_title,
    caption: generated.caption,
    hashtags: generated.hashtags,
    sourceUrl: article.sourceUrl,
    externalUrl: article.externalUrl,
    featuredImageUrl: article.featuredImageUrl,
    graphicPath: `/api/graphic/${nextId}`,
    createdAt: new Date().toISOString(),
    approvedAt: undefined,
    queuedAt: undefined,
    scheduledAt: undefined,
    publishedVia: undefined,
    publishExternalId: undefined
  });
}
