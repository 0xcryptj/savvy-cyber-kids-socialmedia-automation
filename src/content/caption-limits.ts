import { contentRules } from "@/config/content-rules";
import { composePostContent } from "./post-text";

/**
 * Caption length, measured the way the platform measures it.
 *
 * A post is not caption-sized, it is caption-plus-hashtags sized: Postiz sends
 * one string, and X counts every character of it. Generation used to be capped
 * at the schema's 2,200 (Instagram's limit) which put every post hundreds of
 * characters over X and left the reviewer to trim by hand in the queue.
 *
 * Kept free of Node-only imports so the queue can offer the same trim in the
 * browser that generation applies on the server.
 */

/** The tightest limit we publish into. X's 280 is the binding constraint. */
export const strictestPlatformLimit: number = contentRules.caption.platformLimit;

/**
 * Characters left for the caption once the hashtags and their separators are
 * accounted for. Measured through `composePostContent` so the arithmetic can
 * never drift from the string actually sent.
 */
export function captionBudget(hashtags: string[], limit: number = strictestPlatformLimit): number {
  const overhead = composePostContent({ caption: "x", hashtags }).length - 1;
  return Math.max(0, limit - overhead);
}

/**
 * The cap to ask the model for, before its hashtags are known. Assumes the
 * longest hashtags the prompt allows, so a model that uses its full allowance
 * still lands inside the limit.
 */
export function plannedCaptionBudget(limit: number = strictestPlatformLimit): number {
  const worstCase = Array.from({ length: contentRules.hashtags.generated }, () => "#".padEnd(contentRules.caption.maxHashtagLength, "x"));
  return captionBudget([...worstCase, ...contentRules.hashtags.required], limit);
}

/** A trailing "Read more: https://…" link, which must survive any trim. */
const trailingLink = /(?:\s+)?(https?:\/\/\S+)\s*$/;
const sentenceEnd = /[.!?]["')\]]?(?=\s|$)/g;

function trimBody(body: string, budget: number): string {
  if (budget <= 0) return "";
  if (body.length <= budget) return body;

  // A clean sentence break reads like finished copy; a mid-thought cut does not.
  let lastSentence = -1;
  for (const match of body.matchAll(sentenceEnd)) {
    const end = match.index! + match[0].length;
    if (end <= budget) lastSentence = end;
    else break;
  }
  if (lastSentence > budget * 0.5) return body.slice(0, lastSentence).trim();

  // Otherwise cut on a word boundary and mark it, reserving room for the mark.
  const clipped = body.slice(0, Math.max(0, budget - 1));
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).replace(/[\s,;:]+$/, "")}…`;
}

/**
 * Shortens a caption so caption + hashtags fits the platform limit, keeping any
 * trailing article link intact - the link is the point of the post.
 */
export function fitCaption(caption: string, hashtags: string[], limit: number = strictestPlatformLimit): string {
  const budget = captionBudget(hashtags, limit);
  const source = caption.trim();
  if (source.length <= budget) return source;

  const link = source.match(trailingLink);
  if (!link) return trimBody(source, budget);

  const url = link[1];
  const body = source.slice(0, link.index).trim();
  // A link longer than the whole budget cannot be kept; the words matter more.
  if (url.length + 1 >= budget) return trimBody(body, budget);
  const trimmed = trimBody(body, budget - url.length - 1);
  return trimmed ? `${trimmed} ${url}` : url;
}

/** Whether the composed post already fits, so callers can skip a rewrite. */
export function fitsPlatformLimit(caption: string, hashtags: string[], limit: number = strictestPlatformLimit): boolean {
  return composePostContent({ caption, hashtags }).length <= limit;
}
