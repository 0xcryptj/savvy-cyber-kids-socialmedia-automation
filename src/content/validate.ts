import { contentRules } from "@/config/content-rules";
import { FinalSocialPost, GeneratedSocialPost, finalSocialPostSchema, generatedSocialPostSchema } from "./schema";
import { fitCaption } from "./caption-limits";

const emojiPattern = /[\p{Extended_Pictographic}\uFE0F]/gu;

export function removeCaptionEmojis(value: string): string {
  return value.replace(emojiPattern, "").replace(/[ \t]{2,}/g, " ").trim();
}

export function validateGeneratedPost(input: unknown, originalTitle: string): GeneratedSocialPost {
  const parsed = generatedSocialPostSchema.parse(input);
  if (parsed.article_title !== originalTitle) throw new Error("Generated output changed the original article title");
  if (parsed.hashtags.some((tag) => contentRules.hashtags.required.includes(tag as never))) {
    throw new Error("The model must not generate fixed application hashtags");
  }
  return parsed;
}

/**
 * The last step before a post enters review, and the only place the platform
 * limit can be enforced against the real hashtags. The prompt asks the model to
 * write short; this guarantees it, so a reviewer never opens the queue to copy
 * that X would reject.
 */
export function buildFinalPost(input: GeneratedSocialPost): FinalSocialPost {
  const hashtags = [...input.hashtags, ...contentRules.hashtags.required];
  return finalSocialPostSchema.parse({
    ...input,
    caption: fitCaption(removeCaptionEmojis(input.caption), hashtags),
    hashtags
  });
}

export function validateEditableHashtags(input: unknown): string[] {
  const parsed = finalSocialPostSchema.shape.hashtags.parse(input);
  for (const required of contentRules.hashtags.required) {
    if (!parsed.includes(required)) throw new Error(`The required hashtag ${required} cannot be removed`);
  }
  return parsed;
}
