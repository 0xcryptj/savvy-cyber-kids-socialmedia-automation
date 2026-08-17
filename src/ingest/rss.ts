import { feedConfig } from "@/config/feeds";
export async function discoverFeedItems(feedUrl = feedConfig.primary): Promise<unknown[]> {
  const response = await fetch(feedUrl, { next: { revalidate: 900 } });
  if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
  return [{ feedUrl, rawXml: await response.text() }];
}
