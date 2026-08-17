import { GeneratedSocialPost } from "./schema";
import { buildFinalPost, validateGeneratedPost } from "./validate";
export function createMockPost(title: string): GeneratedSocialPost { return validateGeneratedPost({ topic_heading: "SMARTER DIGITAL HABITS", article_title: title, caption: "A positive, practical look at how families can build safer digital habits together. Explore the article for ideas you can try today.", hashtags: ["#DigitalSafety", "#FamilyTech"] }, title); }
export function finalizeGeneratedPost(input: GeneratedSocialPost) { return buildFinalPost(input); }
