import { describe, expect, it } from "vitest";
import { parseRssItems } from "@/src/ingest/rss";

describe("RSS media extraction", () => {
  it("extracts image tags with normal HTML word boundaries", () => {
    const items = parseRssItems('<item><title>News story</title><link>https://example.com/story</link><description><![CDATA[<img src="/image.jpg">]]></description></item>');
    expect(items[0]?.imageUrl).toBe("/image.jpg");
  });

  it("does not discard an item when its image URL is malformed", () => {
    const items = parseRssItems('<item><title>News story</title><link>https://example.com/story</link><enclosure url="not a url" /></item>');
    expect(items).toHaveLength(1);
    expect(items[0]?.link).toBe("https://example.com/story");
  });
});
