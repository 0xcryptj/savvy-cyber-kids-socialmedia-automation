export type ArticleInput = { sourceType: "rss" | "manual_url"; sourceUrl: string; canonicalUrl: string; title: string; body: string; featuredImageUrl?: string; publishedAt?: Date };
export async function ingestManualUrl(url: string): Promise<ArticleInput> { return { sourceType: "manual_url", sourceUrl: url, canonicalUrl: url, title: "Manual ingestion pending", body: "", }; }
