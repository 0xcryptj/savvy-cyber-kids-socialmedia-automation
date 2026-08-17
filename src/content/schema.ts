import { z } from "zod";

const hashtag = z.string().regex(/^#[A-Za-z0-9_]+$/, "Hashtags must start with # and contain no spaces");

export const generatedSocialPostSchema = z.object({
  topic_heading: z.string().trim().min(1).max(60),
  article_title: z.string().trim().min(1),
  caption: z.string().trim().min(1).max(2_200),
  hashtags: z.array(hashtag).length(2)
});

export type GeneratedSocialPost = z.infer<typeof generatedSocialPostSchema>;

export const finalSocialPostSchema = generatedSocialPostSchema.extend({
  hashtags: z.array(hashtag).length(4)
});

export type FinalSocialPost = z.infer<typeof finalSocialPostSchema>;
