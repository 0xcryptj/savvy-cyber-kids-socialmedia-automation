import { ContentCategory, feedConfig } from "@/config/feeds";
import { fetchJson, fetchText } from "./http";
import { decodeHtml, firstSentences, htmlToText, tagsFromClassList } from "./html";
import { extractOpenGraph } from "./opengraph";
import { SourceArticle } from "./types";
import { discoverFeedItems } from "./rss";
import { scrapeSourcePage } from "./scrape";
import { unstable_cache } from "next/cache";

export const getFeedHealth = unstable_cache(async () => {
  const results = await Promise.allSettled([listSourceArticles("blog"), listSourceArticles("news")]);
  return { blog: results[0].status === "fulfilled", news: results[1].status === "fulfilled" };
}, ["feed-health"], { revalidate: 300 });

type WpRendered = { rendered?: string };
type WpPost = {
  id: number;
  date: string;
  link: string;
  title?: WpRendered;
  content?: WpRendered;
  excerpt?: WpRendered;
  featured_media?: number;
  class_list?: string[];
  meta?: { curated_article_url?: string };
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>;
  };
};

function featuredImage(post: WpPost): string | undefined {
  return post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
}

function toBlogArticle(post: WpPost): SourceArticle {
  const title = decodeHtml(htmlToText(post.title?.rendered ?? "Untitled"));
  const body = htmlToText(post.content?.rendered ?? "");
  return {
    id: `blog_${post.id}`,
    category: "blog",
    sourceUrl: post.link,
    canonicalUrl: post.link,
    title,
    excerpt: firstSentences(body) || htmlToText(post.excerpt?.rendered ?? ""),
    body,
    featuredImageUrl: featuredImage(post),
    tags: tagsFromClassList(post.class_list),
    publishedAt: post.date
  };
}

function toNewsArticle(post: WpPost): SourceArticle {
  const title = decodeHtml(htmlToText(post.title?.rendered ?? "Untitled"));
  const externalUrl = post.meta?.curated_article_url;
  return {
    id: `news_${post.id}`,
    category: "news",
    sourceUrl: post.link,
    canonicalUrl: externalUrl || post.link,
    externalUrl,
    title,
    excerpt: title,
    body: "",
    featuredImageUrl: featuredImage(post),
    tags: ["cyber safety", "digital citizenship"],
    publishedAt: post.date
  };
}

export async function listSourceArticles(category: ContentCategory): Promise<SourceArticle[]> {
  try {
    const { rssUrl, perPage } = feedConfig[category];
    const items = await discoverFeedItems(rssUrl);
    if (items.length) return items.slice(0, perPage).map((item, index) => ({
      id: `${category}_rss_${index}_${Buffer.from(item.link).toString("base64url").slice(0, 10)}`,
      category, sourceType: "rss" as const, sourceUrl: item.link, canonicalUrl: item.link,
      title: item.title, excerpt: firstSentences(item.body) || item.title, body: htmlToText(item.body),
      featuredImageUrl: item.imageUrl, tags: [], publishedAt: item.publishedAt || new Date().toISOString()
    }));
  } catch { /* try the WordPress API next */ }

  if (category === "blog") try {
    const { restUrl, perPage } = feedConfig[category];
    const query = `?categories=${feedConfig.blog.wpCategoryId}&per_page=${perPage}&_embed=1`;
    const posts = await fetchJson<WpPost[]>(`${restUrl}${query}`);
    if (posts.length) return posts.map(category === "blog" ? toBlogArticle : toNewsArticle);
  } catch { /* scrape the public archive when APIs are unavailable */ }

  return scrapeSourcePage(category);
}

export async function findSourceArticle(category: ContentCategory, canonicalUrl: string): Promise<SourceArticle | undefined> {
  const articles = await listSourceArticles(category);
  return articles.find((article) => article.canonicalUrl === canonicalUrl || article.sourceUrl === canonicalUrl);
}

export async function hydrateArticle(article: SourceArticle): Promise<SourceArticle> {
  if (article.category !== "news" || !article.externalUrl) return article;

  try {
    const html = await fetchText(article.externalUrl, 900);
    const og = extractOpenGraph(html);
    const description = og.description ? decodeHtml(htmlToText(og.description)) : article.excerpt;
    return {
      ...article,
      featuredImageUrl: article.featuredImageUrl ?? (og.imageUrl ? new URL(og.imageUrl, article.externalUrl).toString() : undefined),
      excerpt: description,
      body: description
    };
  } catch {
    return article;
  }
}
