import { randomUUID } from "crypto";
import { ContentCategory } from "@/config/feeds";
import { generateSocialPost, finalizeGeneratedPost } from "@/src/content/generate";
import { findSourceArticle, hydrateArticle } from "@/src/ingest/wordpress";
import { SourceArticle } from "@/src/ingest/types";
import { findPostByCanonicalUrl, savePost } from "@/src/workspace/store";
import { WorkspacePost } from "@/src/workspace/types";

export async function processArticle(input: { canonicalUrl: string; category: ContentCategory; sourceArticle?: SourceArticle }): Promise<WorkspacePost> {
  const existing = await findPostByCanonicalUrl(input.canonicalUrl);
  if (existing) return existing;

  const selected = input.sourceArticle && input.sourceArticle.category === input.category && (input.sourceArticle.canonicalUrl === input.canonicalUrl || input.sourceArticle.sourceUrl === input.canonicalUrl)
    ? input.sourceArticle
    : undefined;
  const found = selected ? undefined : await findSourceArticle(input.category, input.canonicalUrl);
  if (!found && !selected) throw new Error("That article is not in the live blog or news feeds.");

  const article = await hydrateArticle(found ?? selected!);
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
