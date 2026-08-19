import { ContentCategory } from "@/config/feeds";
import { z } from "zod";

export const sourceArticleSchema = z.object({
  id: z.string().min(1).max(200),
  category: z.enum(["blog", "news"]),
  sourceUrl: z.string().url().max(2048),
  canonicalUrl: z.string().url().max(2048),
  externalUrl: z.string().url().max(2048).optional(),
  title: z.string().min(1).max(500),
  excerpt: z.string().max(20_000),
  body: z.string().max(100_000),
  featuredImageUrl: z.string().url().max(2048).optional(),
  tags: z.array(z.string().max(100)).max(50),
  publishedAt: z.string().min(1).max(100),
  sourceType: z.enum(["rss", "manual_url", "wordpress", "scrape"]).optional()
});

export type SourceArticle = {
  id: string;
  category: ContentCategory;
  sourceUrl: string;
  canonicalUrl: string;
  externalUrl?: string;
  title: string;
  excerpt: string;
  body: string;
  featuredImageUrl?: string;
  tags: string[];
  publishedAt: string;
  sourceType?: "rss" | "manual_url" | "wordpress" | "scrape";
};

export type ArticleInput = SourceArticle & {
  sourceType: "rss" | "manual_url" | "wordpress" | "scrape";
};
