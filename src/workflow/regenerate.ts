import { randomUUID } from "crypto";
import { ContentCategory } from "@/config/feeds";
import { generateSocialPost, finalizeGeneratedPost } from "@/src/content/generate";
import { findSourceArticle, hydrateArticle } from "@/src/ingest/wordpress";
import { SourceArticle } from "@/src/ingest/types";
import { getPost, savePost, recallApprovedLayout } from "@/src/workspace/store";
import { WorkspacePost } from "@/src/workspace/types";
import { boundedText } from "@/src/lib/request-security";
import { inspectArticleImage, generateOpenAIBackground } from "@/src/design/openai-image";
import { layoutKey } from "@/src/design/layout-memory";

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

async function resolveArticle(previous: WorkspacePost): Promise<{ article: SourceArticle; usedFallbackSource: boolean }> {
  try {
    const refreshed = await findSourceArticle(previous.category as ContentCategory, previous.externalUrl || previous.sourceUrl);
    if (refreshed) return { article: await hydrateArticle(refreshed), usedFallbackSource: false };
  } catch {
    // Regeneration remains available when the source feed is temporarily down.
  }
  return { article: fallbackArticle(previous), usedFallbackSource: true };
}

export async function regeneratePost(id: string, reviewerGuidance?: string): Promise<WorkspacePost> {
  const previous = await getPost(id);
  if (!previous) throw new Error("Post not found");

  const { article, usedFallbackSource } = await resolveArticle(previous);
  const guidance = boundedText(reviewerGuidance, 1000);
  const generatedRaw = await generateSocialPost(article, guidance);
  const generated = finalizeGeneratedPost(generatedRaw);
  let generatedImageUrl: string | undefined;
  const sourceImage = await inspectArticleImage(article.featuredImageUrl);
  if (!sourceImage.available) {
    try {
      generatedImageUrl = await generateOpenAIBackground({ topicHeading: generated.topic_heading, articleTitle: generated.article_title, articleImage: article.featuredImageUrl, guidance });
    } catch (error) {
      console.warn("OpenAI fallback graphic unavailable:", error instanceof Error ? error.message : "unknown error");
    }
  }
  const nextId = `post_${randomUUID().slice(0, 8)}`;
  // A manual layout the reviewer already set on this post outlives a
  // regeneration; otherwise fall back to what was approved for this shape.
  const rememberedLayout = previous.graphicAdjustments
    ?? await recallApprovedLayout(layoutKey({ category: previous.category, sourceImageRatio: sourceImage.ratio, sourceImageHasText: generatedRaw.source_image_has_text }));
  await savePost({ ...previous, status: "SUPERSEDED", supersededBy: nextId, frozenGraphicPath: undefined });
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
    generatedImageUrl,
    graphicGenerationStatus: generatedImageUrl ? "AI_GENERATED" : article.featuredImageUrl ? "SOURCE_ARTICLE" : "SOURCE_FALLBACK",
    sourceImageHasText: generatedRaw.source_image_has_text || undefined,
    sourceImageRatio: sourceImage.ratio,
    graphicAdjustments: rememberedLayout,
    graphicPath: `/api/graphic/${nextId}`,
    frozenGraphicPath: undefined,
    supersededBy: undefined,
    graphicGuidance: [guidance, generatedRaw.graphic_guidance].filter(Boolean).join(" ").slice(0, 1000) || undefined,
    usedFallbackSource,
    createdAt: new Date().toISOString(),
    approvedAt: undefined,
    queuedAt: undefined,
    scheduledAt: undefined,
    publishedVia: undefined,
    publishExternalId: undefined
  });
}

/**
 * Rewrites only the caption and hashtags, leaving the topic heading, article
 * title, and graphic untouched. A full regenerate reflows the graphic too,
 * which is wasted work - and destructive on an approved post, whose graphic is
 * already frozen - when the reviewer just wants different words.
 */
export async function regenerateCaption(id: string, reviewerGuidance?: string): Promise<WorkspacePost> {
  const previous = await getPost(id);
  if (!previous) throw new Error("Post not found");

  const { article } = await resolveArticle(previous);
  const guidance = boundedText(reviewerGuidance, 1000);
  const generatedRaw = await generateSocialPost(article, guidance);
  const { caption, hashtags } = finalizeGeneratedPost(generatedRaw);
  return savePost({ ...previous, caption, hashtags });
}
