import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { SourceArticle } from "@/src/ingest/types";
import { generatedSocialPostSchema, GeneratedSocialPost } from "./schema";
import { createLocalPost } from "./local-copy";
import { buildFinalPost, validateGeneratedPost } from "./validate";

export function finalizeGeneratedPost(input: GeneratedSocialPost) {
  return buildFinalPost(input);
}

async function generateWithOpenAI(article: SourceArticle): Promise<GeneratedSocialPost> {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: generatedSocialPostSchema,
    system: `Create a warm, practical Savvy Cyber Kids social post for families. Preserve the article title exactly. Return exactly two topical hashtags; do not include #savvycyberkids or #cyberhero.`,
    prompt: `Article title (preserve exactly): ${article.title}\nCategory: ${article.category}\n\nBody:\n${(article.body || article.excerpt).slice(0, 4000)}`
  });
  return validateGeneratedPost({ ...object, article_title: article.title }, article.title);
}

export async function generateSocialPost(article: SourceArticle): Promise<GeneratedSocialPost> {
  if (!process.env.OPENAI_API_KEY) return createLocalPost(article);
  try {
    return await generateWithOpenAI(article);
  } catch {
    return createLocalPost(article);
  }
}
