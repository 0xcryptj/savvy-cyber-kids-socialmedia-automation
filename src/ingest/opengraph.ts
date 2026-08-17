export type OpenGraphMetadata = {
  canonicalUrl?: string;
  title?: string;
  imageUrl?: string;
  description?: string;
};

function metaContent(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const property = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)`, "i"))?.[1];
    const reversed = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i"))?.[1];
    const value = property ?? reversed;
    if (value) return value;
  }
  return undefined;
}

export function extractOpenGraph(html: string): OpenGraphMetadata {
  return {
    canonicalUrl: metaContent(html, ["og:url"]),
    title: metaContent(html, ["og:title", "twitter:title"]),
    imageUrl: metaContent(html, ["og:image", "twitter:image", "twitter:image:src"]),
    description: metaContent(html, ["og:description", "twitter:description", "description"])
  };
}
