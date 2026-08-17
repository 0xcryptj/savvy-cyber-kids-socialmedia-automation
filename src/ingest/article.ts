import { ContentCategory } from "@/config/feeds";
import { ArticleInput } from "./types";
import { findSourceArticle, hydrateArticle } from "./wordpress";

export async function ingestManualUrl(url: string, category: ContentCategory = "blog"): Promise<ArticleInput> {
  const found = await findSourceArticle(category, url);
  if (!found) {
    return {
      id: `manual_${Date.now()}`,
      category,
      sourceType: "manual_url",
      sourceUrl: url,
      canonicalUrl: url,
      title: "Manual ingestion pending",
      excerpt: "",
      body: "",
      tags: [],
      publishedAt: new Date().toISOString()
    };
  }
  return { ...(await hydrateArticle(found)), sourceType: "wordpress" };
}
