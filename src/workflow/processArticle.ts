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

  // The library sends the complete article the user clicked. Trust that
  // validated payload instead of re-looking it up by URL: RSS, WordPress,
  // redirects, and scraped canonical URLs do not always agree byte-for-byte.
  const selected = input.sourceArticle && input.sourceArticle.category === input.category
    ? input.sourceArticle
    : undefined;
  const found = selected ? undefined : await findSourceArticle(input.category, input.canonicalUrl);
  if (!found && !selected) {
    throw new Error(`The ${input.category} source could not be matched after refresh. Refresh the ${input.category} feed and try creating the post again.`);
  }

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
