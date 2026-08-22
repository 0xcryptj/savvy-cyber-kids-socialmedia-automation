import { getAISettings } from "@/src/config/ai-settings";
import { getStoredCredential } from "@/src/config/credentials";
import { DesignRenderer, RenderRequest, RenderedGraphic } from "./renderer";

type ImageResponsePayload = { data?: Array<{ b64_json?: string; url?: string }> };

export type ArticleImageInfo = { available: boolean; ratio?: number };

/**
 * Fetches the article image once and reports both whether it is usable and its
 * aspect ratio, which is what decides how the composer should frame it and
 * which remembered layout applies.
 */
export async function inspectArticleImage(imageUrl?: string): Promise<ArticleImageInfo> {
  if (!imageUrl) return { available: false };
  try {
    const response = await fetch(imageUrl.replaceAll("&amp;", "&"), { headers: { Accept: "image/*" }, redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (!response.ok || !(response.headers.get("content-type") || "").startsWith("image/")) return { available: false };
    try {
      const sharp = (await import("sharp")).default;
      const { width, height } = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
      return { available: true, ratio: width && height ? width / height : undefined };
    } catch {
      // Usable, just unmeasurable: no remembered layout, but still a valid image.
      return { available: true };
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
  const prompt = `Create a premium editorial background for a family cybersecurity social-media post. Topic: ${input.topicHeading}. Article: ${input.articleTitle}. ${input.guidance || ""}

Use a polished 4:5 portrait composition with a strong visual focal point in the upper two-thirds, generous but intentional negative space for a local text overlay in the lower third, atmospheric gradients and cohesive navy, cyan, and warm orange accents. The image must feel like an enterprise newsroom graphic: clean hierarchy, refined lighting, balanced spacing, and no accidental black voids. Do not render any words, letters, numbers, logos, watermarks, banners, or fake UI. Do not place important details against the edges.`.slice(0, 3500);
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
