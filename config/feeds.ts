import { sourceUrls } from "./urls";

export const contentCategories = ["blog", "news"] as const;
export type ContentCategory = (typeof contentCategories)[number];

export const feedConfig = {
  blog: {
    category: "blog" as const,
    label: "Blog content",
    pageUrl: sourceUrls.blog,
    rssUrl: "https://savvycyberkids.org/blog/feed/",
    restUrl: "https://savvycyberkids.org/wp-json/wp/v2/posts",
    wpCategoryId: 15,
    perPage: 12
  },
  news: {
    category: "news" as const,
    label: "News feed content",
    pageUrl: sourceUrls.newsFeed,
    rssUrl: "https://savvycyberkids.org/news/feed/",
    restUrl: "https://savvycyberkids.org/wp-json/wp/v2/posts",
    wpCategoryId: 24,
    perPage: 16
  }
} as const;
