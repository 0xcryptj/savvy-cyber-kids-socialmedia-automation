import { randomUUID } from "crypto";
import { ContentCategory } from "@/config/feeds";
import { generateSocialPost, finalizeGeneratedPost } from "@/src/content/generate";
import { findSourceArticle, hydrateArticle } from "@/src/ingest/wordpress";
import { findPostByCanonicalUrl, savePost } from "@/src/workspace/store";
import { WorkspacePost } from "@/src/workspace/types";

export async function processArticle(input: { canonicalUrl: string; category: ContentCategory }): Promise<WorkspacePost> {
  const existing = await findPostByCanonicalUrl(input.canonicalUrl);
  if (existing) return existing;

  const found = await findSourceArticle(input.category, input.canonicalUrl);
  if (!found) throw new Error("That article is not in the live blog or news feeds.");

  const article = await hydrateArticle(found);
  const generated = finalizeGeneratedPost(await generateSocialPost(article));
  const id = `post_${randomUUID().slice(0, 8)}`;

  return savePost({
    id,
    articleId: article.id,
    category: article.category,
    status: "PENDING_REVIEW",
    topicHeading: generated.topic_heading,
    articleTitle: generated.article_title,
    caption: generated.caption,
    hashtags: generated.hashtags,
    sourceUrl: article.sourceUrl,
    externalUrl: article.externalUrl,
    featuredImageUrl: article.featuredImageUrl,
    graphicPath: `/api/graphic/${id}`,
    publishedAt: article.publishedAt,
    createdAt: new Date().toISOString()
  });
}
