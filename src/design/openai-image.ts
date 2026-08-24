import { safeFetch } from "@/src/lib/safe-fetch";
import { getAISettings } from "@/src/config/ai-settings";
import { getStoredCredential } from "@/src/config/credentials";
import { DesignRenderer, RenderRequest, RenderedGraphic } from "./renderer";

type ImageResponsePayload = { data?: Array<{ b64_json?: string; url?: string }> };

export type ArticleImageInfo = { available: boolean; ratio?: number };

/**
 * Fetches the article image once and reports whether the composer can actually
 * draw it, plus its aspect ratio.
 *
 * "Available" has to mean renderable, not merely fetchable. A URL that returns
 * 200 with a format the renderer cannot decode used to pass this check and then
 * land in the review queue as IMAGE UNAVAILABLE, with no fallback — so the same
 * Accept header the renderer sends is used here, and the bytes must decode.
 */
export async function inspectArticleImage(imageUrl?: string): Promise<ArticleImageInfo> {
  if (!imageUrl) return { available: false };
  try {
    // Article image URLs arrive with the article, so they are untrusted.
    const response = await safeFetch(imageUrl.replaceAll("&amp;", "&"), {
      headers: { Accept: "image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.5" },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return { available: false };
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) return { available: false };
    try {
      const sharp = (await import("sharp")).default;
      const { width, height } = await sharp(bytes).metadata();
      if (!width || !height) return { available: false };
      return { available: true, ratio: width / height };
    } catch {
      // Without sharp, fall back to trusting the content type. The renderer
      // sniffs the bytes itself, so a wrong guess degrades rather than breaks.
      return { available: (response.headers.get("content-type") || "").startsWith("image/") };
    }
  } catch {
    return { available: false };
  }
}

export async function articleImageAvailable(imageUrl?: string): Promise<boolean> {
  return (await inspectArticleImage(imageUrl)).available;
}

async function imageApiKey() {
  const settings = await getAISettings();
  if (settings.provider !== "openai") throw new Error("OpenAI image generation requires the OpenAI provider");
  return { settings, key: (await getStoredCredential("openai")) || process.env.OPENAI_API_KEY || process.env.AI_API_KEY };
}

export async function generateOpenAIBackground(input: RenderRequest & { guidance?: string }): Promise<string> {
  const { settings, key } = await imageApiKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const base = (settings.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const prompt = `A photorealistic editorial photograph for a family cybersecurity article. Topic: ${input.topicHeading}. Article: ${input.articleTitle}. ${input.guidance || ""}

Shoot it like a real photograph taken on a full-frame camera with a fast prime lens: natural available light, true-to-life skin tones and materials, believable depth of field, subtle imperfection, the look of documentary lifestyle photography rather than stock. Real people and real rooms, warm and unposed, safe and age-appropriate.

Composition: 4:5 portrait. Put the subject in the upper two-thirds and keep the lower third quieter and less detailed, because a headline is composited over it afterwards. Keep important detail away from all four edges, since the frame may be cropped.

Do not render any words, letters, numbers, logos, watermarks, banners, user interface, or screen content. Nothing illustrated, 3D-rendered, cartoon, or synthetic-looking. No heavy colour grading and no glowing blue technology clichés.`.slice(0, 3500);
  const response = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1", prompt, size: "1024x1536", quality: "high", n: 1, output_format: "png" })
  });
  if (!response.ok) throw new Error(`OpenAI image request failed (${response.status})`);
  const payload = await response.json() as ImageResponsePayload;
  const item = payload.data?.[0];
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item?.url) {
    const image = await fetch(item.url);
    if (!image.ok) throw new Error("OpenAI returned an inaccessible image URL");
    return `data:${image.headers.get("content-type") || "image/png"};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
  }
  throw new Error("OpenAI returned no image data");
}

export class OpenAIImageRenderer implements DesignRenderer {
  async render(request: RenderRequest): Promise<RenderedGraphic> {
    return { path: await generateOpenAIBackground(request), provider: "openai" };
  }
}
