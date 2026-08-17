import { ContentCategory } from "@/config/feeds";

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
