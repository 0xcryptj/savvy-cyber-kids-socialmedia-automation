import { feedConfig } from "@/config/feeds";
import { fetchText } from "./http";
import { decodeHtml, htmlToText } from "./html";

export type RssItem = {
  title: string;
  link: string;
  publishedAt?: string;
  imageUrl?: string;
  body: string;
};

function tagValue(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeHtml(htmlToText(match[1])) : undefined;
}

function attributeValue(block: string, tag: string, attribute: string): string | undefined {
  return block.match(new RegExp(`<${tag}\\b[^>]*\\b${attribute}=["']([^"']+)["']`, "i"))?.[1];
}

function itemImageUrl(item: string): string | undefined {
  return attributeValue(item, "enclosure", "url")
    ?? attributeValue(item, "media:content", "url")
    ?? attributeValue(item, "media:thumbnail", "url")
    ?? item.match(/<img\\b[^>]*\\bsrc=["']([^"']+)["']/i)?.[1];
}

export function parseRssItems(xml: string): RssItem[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return items.map((item) => ({
    title: tagValue(item, "title") ?? "Untitled",
    link: tagValue(item, "link") ?? "",
    publishedAt: tagValue(item, "pubDate"),
    imageUrl: itemImageUrl(item),
    body: tagValue(item, "content:encoded") ?? tagValue(item, "description") ?? ""
  })).filter((item) => item.link);
}

export async function discoverFeedItems(feedUrl: string = feedConfig.blog.rssUrl): Promise<RssItem[]> {
  const xml = await fetchText(feedUrl, 900);
  return parseRssItems(xml).map((item) => ({
    ...item,
    imageUrl: item.imageUrl ? new URL(item.imageUrl, feedUrl).toString() : undefined
  }));
}
