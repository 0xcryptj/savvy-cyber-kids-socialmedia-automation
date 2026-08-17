import { contentRules } from "@/config/content-rules";
import { SourceArticle } from "@/src/ingest/types";
import { GeneratedSocialPost } from "./schema";
import { firstSentences } from "@/src/ingest/html";

const skipTags = new Set(["student submissions", "educator", "guest blogger"]);
const topicFromTag: Record<string, string> = {
  "social media": "SOCIAL MEDIA",
  gaming: "GAMING",
  privacy: "PRIVACY",
  "cyber security": "CYBER SECURITY",
  "digital parenting": "DIGITAL PARENTING"
};

const stopWords = new Set(["the", "a", "an", "of", "for", "and", "or", "to", "in", "on", "how", "what", "why", "with", "from", "your", "you", "is", "are", "was", "be", "just", "more", "than"]);

function toHashtag(label: string): string {
  const compact = label.replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join("");
  return `#${compact}`;
}

export function topicHeadingFromArticle(article: Pick<SourceArticle, "title" | "tags" | "category">): string {
  if (article.category === "news") {
    const newsTag = article.tags.map((tag) => topicFromTag[tag.toLowerCase()]).find(Boolean);
    return newsTag ?? "CYBER SAFETY NEWS";
  }

  for (const tag of article.tags) {
    const mapped = topicFromTag[tag.toLowerCase()];
    if (mapped) return mapped;
  }

  const words = article.title.replace(/[^A-Za-z0-9\s]/g, " ").split(/\s+/).filter((word) => word && !stopWords.has(word.toLowerCase()));
  return (words.slice(0, 4).join(" ") || article.title).toUpperCase().slice(0, 40);
}

export function hashtagsFromArticle(article: Pick<SourceArticle, "title" | "tags">): [string, string] {
  const fromTags = article.tags
    .filter((tag) => !skipTags.has(tag.toLowerCase()))
    .map(toHashtag)
    .filter((tag) => !contentRules.hashtags.required.includes(tag as never) && /^#[A-Za-z0-9_]+$/.test(tag));

  const unique = [...new Set(fromTags)];
  if (unique.length >= 2) return [unique[0], unique[1]];

  const titleTags = article.title
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word.toLowerCase()))
    .slice(0, 3)
    .map(toHashtag)
    .filter((tag) => !unique.includes(tag) && !contentRules.hashtags.required.includes(tag as never));
  const extras = [...titleTags, "#OnlineSafety", "#DigitalCitizenship", "#FamilyTech", "#CyberAwareness"]
    .filter((tag) => !unique.includes(tag) && !contentRules.hashtags.required.includes(tag as never));
  const filled = [...unique, ...extras];
  return [filled[0], filled[1]];
}

export function captionFromArticle(article: SourceArticle): string {
  const excerpt = firstSentences(article.body || article.excerpt || article.title, 2, 380);
  const link = article.externalUrl || article.sourceUrl;
  if (article.category === "news") {
    return `${excerpt} This headline is worth a family conversation about staying savvy online. Read more: ${link}`;
  }
  return `${excerpt} Read the full Savvy Cyber Kids article: ${link}`;
}

export function createLocalPost(article: SourceArticle): GeneratedSocialPost {
  return {
    topic_heading: topicHeadingFromArticle(article),
    article_title: article.title,
    caption: captionFromArticle(article),
    hashtags: hashtagsFromArticle(article)
  };
}

export function highlightedTitleParts(title: string): { plain: string; highlight: string } {
  if (title.includes(":")) {
    const [plain, ...rest] = title.split(":");
    return { plain: `${plain.trim()}:`, highlight: rest.join(":").trim() };
  }
  const words = title.trim().split(/\s+/);
  if (words.length < 5) return { plain: "", highlight: title };
  const splitAt = Math.max(2, Math.ceil(words.length * 0.55));
  return { plain: words.slice(0, splitAt).join(" "), highlight: words.slice(splitAt).join(" ") };
}
