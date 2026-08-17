import { contentRules } from "@/config/content-rules";
import { FinalSocialPost, GeneratedSocialPost, finalSocialPostSchema, generatedSocialPostSchema } from "./schema";

export function validateGeneratedPost(input: unknown, originalTitle: string): GeneratedSocialPost {
  const parsed = generatedSocialPostSchema.parse(input);
  if (parsed.article_title !== originalTitle) throw new Error("Generated output changed the original article title");
  if (parsed.hashtags.some((tag) => contentRules.hashtags.required.includes(tag as never))) {
    throw new Error("The model must not generate fixed application hashtags");
  }
  return parsed;
}

export function buildFinalPost(input: GeneratedSocialPost): FinalSocialPost {
  return finalSocialPostSchema.parse({ ...input, hashtags: [...input.hashtags, ...contentRules.hashtags.required] });
}
