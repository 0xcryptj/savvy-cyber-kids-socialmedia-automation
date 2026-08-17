import { ContentCategory, feedConfig } from "@/config/feeds";
import { fetchText } from "./http";
import { decodeHtml, firstSentences, htmlToText } from "./html";
import { extractOpenGraph } from "./opengraph";
import { OpenGraphMetadata } from "./opengraph";
import { SourceArticle } from "./types";

type ListingLink = { title: string; url: string };

function absoluteUrl(value: string, base: string) {
  try { return new URL(value, base).toString(); } catch { return value; }
}

export function listingLinks(html: string, category: ContentCategory): ListingLink[] {
  const links: ListingLink[] = [];
  const seen = new Set<string>();
  const sourceUrl = feedConfig[category].pageUrl;
  const marker = html.search(/Headlines from across the globe/i);
  const block = category === "news" && marker >= 0 ? html.slice(marker) : html;
  const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(block))) {
    const url = absoluteUrl(match[1], sourceUrl);
    const title = decodeHtml(htmlToText(match[2]));
    if (!title || title.length < 12 || seen.has(url) || url === sourceUrl) continue;
    if (category === "blog") {
      try {
        const parsed = new URL(url);
        if (parsed.hostname !== "savvycyberkids.org" || !/\/20\d{2}\/\d{2}\//.test(parsed.pathname)) continue;
      } catch { continue; }
    }
    if (category === "news" && url.includes("savvycyberkids.org")) continue;
    if (/^(read more|gallery|next|previous)$/i.test(title)) continue;
    seen.add(url);
    links.push({ title, url });
  }
  if (!links.length) throw new Error(`No ${category} articles found at ${sourceUrl}`);
  return links;
}

export async function scrapeSourcePage(category: ContentCategory): Promise<SourceArticle[]> {
  const html = await fetchText(feedConfig[category].pageUrl, 900);
  const links = listingLinks(html, category).slice(0, feedConfig[category].perPage);
  return Promise.all(links.map(async ({ title, url }, index) => {
    let metadata: OpenGraphMetadata = {};
    try { metadata = extractOpenGraph(await fetchText(url, 900)); } catch { /* keep the listing title */ }
    const description = metadata.description ? decodeHtml(htmlToText(metadata.description)) : "";
    return {
      id: `${category}_scrape_${index}_${Buffer.from(url).toString("base64url").slice(0, 10)}`,
      category,
      sourceType: "scrape" as const,
      sourceUrl: url,
      canonicalUrl: metadata.canonicalUrl || url,
      externalUrl: category === "news" ? url : undefined,
      title: metadata.title ? decodeHtml(htmlToText(metadata.title)) : title,
      excerpt: firstSentences(description) || title,
      body: description,
      featuredImageUrl: metadata.imageUrl,
      tags: [],
      publishedAt: new Date().toISOString()
    };
  }));
}
