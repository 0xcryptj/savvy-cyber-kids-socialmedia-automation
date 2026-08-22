import { SourceArticle } from "@/src/ingest/types";
import { generatedSocialPostSchema, GeneratedSocialPost } from "./schema";
import { createLocalPost } from "./local-copy";
import { buildFinalPost, validateGeneratedPost } from "./validate";
import { getAISettings } from "@/src/config/ai-settings";
import { getStoredCredential } from "@/src/config/credentials";
import { recentFeedback } from "@/src/workspace/store";

export function finalizeGeneratedPost(input: GeneratedSocialPost) {
  return buildFinalPost(input);
}

const systemPrompt = `Create a warm, practical Savvy Cyber Kids social post for families. Preserve the article title exactly. Use plain text only: do not use emojis or decorative symbols. Return exactly two topical hashtags; do not include #savvycyberkids or #cyberhero. When an article image is attached, inspect it before deciding graphic_guidance: identify the subject's focal area, whether the image is portrait or landscape, and where the composer can safely place copy. Never ask the image model to replace an available article image. Use short actionable guidance such as "center subject, keep top banner visible, place text over the darker lower area" or "crop to the upper subject and use a navy gradient behind the title". Respond with JSON only matching this shape: {"topic_heading":"string","article_title":"string","caption":"string","hashtags":["#tag1","#tag2"],"graphic_guidance":"optional visual instruction"}.`;

async function apiKey(provider: "openai" | "anthropic" | "openai-compatible") {
  const stored = await getStoredCredential(provider);
  return stored || (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY : process.env.OPENAI_API_KEY || process.env.AI_API_KEY);
}

async function generateWithProvider(article: SourceArticle, reviewerGuidance?: string): Promise<GeneratedSocialPost> {
  const settings = await getAISettings();
  const key = await apiKey(settings.provider);
  if (!key) throw new Error(`${settings.provider} API key is not configured`);
  const feedback = await recentFeedback(article.category);
  const feedbackContext = feedback.length
    ? `\n\nRecent human feedback from this feed:\n${feedback.map((item) => `- ${item.status}: ${item.note || "No note supplied"}`).join("\n")}\nUse this as guidance, but preserve the article title and the required output shape.`
    : "";
  const guidanceContext = reviewerGuidance?.trim()
    ? `\n\nReviewer guidance for this regeneration:\n${reviewerGuidance.trim().slice(0, 1000)}\nApply this guidance to the copy and graphic_guidance while preserving the article title and output shape.`
    : "";
  const prompt = `Article title (preserve exactly): ${article.title}\nCategory: ${article.category}\n\nBody:\n${(article.body || article.excerpt).slice(0, 4000)}${feedbackContext}${guidanceContext}`;
  let response: Response;
  if (settings.provider === "anthropic") {
    response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: settings.model, max_tokens: 900, system: systemPrompt, messages: [{ role: "user", content: prompt }] }) });
  } else {
    const base = (settings.baseUrl || (settings.provider === "openai" ? "https://api.openai.com/v1" : "https://openrouter.ai/api/v1")).replace(/\/$/, "");
    const userContent = settings.provider === "openai" && article.featuredImageUrl
      ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: article.featuredImageUrl } }]
      : prompt;
    response = await fetch(`${base}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: settings.model, temperature: 0.7, response_format: { type: "json_object" }, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }] }) });
  }
  if (!response.ok) throw new Error(`AI provider request failed (${response.status})`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; content?: Array<{ text?: string }> };
  const raw = payload.choices?.[0]?.message?.content || payload.content?.[0]?.text || "";
  const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
  return validateGeneratedPost({ ...generatedSocialPostSchema.parse(parsed), article_title: article.title }, article.title);
}

export async function generateSocialPost(article: SourceArticle, reviewerGuidance?: string): Promise<GeneratedSocialPost> {
  try {
    return await generateWithProvider(article, reviewerGuidance);
  } catch {
    return createLocalPost(article);
  }
}
