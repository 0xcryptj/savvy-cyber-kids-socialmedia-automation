/**
 * What each Postiz provider needs in a create-post payload.
 *
 * Postiz validates `settings` per platform and rejects the whole batch with a
 * 400 when a required field is missing, so anything we cannot derive from an
 * approved post is declared here and caught in preflight instead. Sourced from
 * docs.postiz.com/public-api/providers/*.
 */
export type ProviderRule = {
  /**
   * The platform's own name. Limits belong to the platform, not to whatever
   * the account happens to be nicknamed, so messages say "X allows 280"
   * rather than naming the reviewer's own handle back at them.
   */
  label?: string;
  /** Extra settings we can safely supply ourselves, merged over `__type`. */
  defaults?: Record<string, unknown>;
  /** Max characters the platform accepts for post text. */
  limit?: number;
  /**
   * Set when this dashboard cannot produce a valid payload for the platform.
   * Preflight surfaces the reason and excludes the channel rather than letting
   * Postiz reject the batch.
   */
  unsupported?: string;
};

const rules: Record<string, ProviderRule> = {
  // Text + image platforms we can fully satisfy.
  x: { label: "X", defaults: { who_can_reply_post: "everyone" }, limit: 280 },
  facebook: { label: "Facebook", limit: 63_206 },
  instagram: { label: "Instagram", defaults: { post_type: "post" }, limit: 2_200 },
  "instagram-standalone": { label: "Instagram", defaults: { post_type: "post" }, limit: 2_200 },
  linkedin: { label: "LinkedIn", limit: 3_000 },
  "linkedin-page": { label: "LinkedIn page", limit: 3_000 },
  threads: { label: "Threads", limit: 500 },
  mastodon: { label: "Mastodon", limit: 500 },
  bluesky: { label: "Bluesky", limit: 300 },
  telegram: { label: "Telegram", limit: 4_096 },
  slack: { label: "Slack", limit: 3_000 },
  warpcast: { label: "Warpcast", limit: 320 },
  farcaster: { label: "Farcaster", limit: 320 },
  mattermost: { label: "Mattermost", limit: 16_383 },
  mattermost_provider: { label: "Mattermost", limit: 16_383 },

  // Video platforms: the branded template renders a 4:5 PNG, not a video.
  youtube: { label: "YouTube", unsupported: "YouTube needs a video upload and a title. Post it from Postiz directly." },
  tiktok: { label: "TikTok", unsupported: "TikTok needs a video upload. Post it from Postiz directly." },

  // Require an account-specific target we have no way to look up from here.
  pinterest: { label: "Pinterest", unsupported: "Pinterest needs a board ID. Post it from Postiz directly." },
  reddit: { label: "Reddit", unsupported: "Reddit needs a subreddit and post title. Post it from Postiz directly." },
  discord: { label: "Discord", unsupported: "Discord needs a channel ID. Post it from Postiz directly." }
};

export function providerRule(identifier: string): ProviderRule {
  // Unknown identifiers stay permissive on purpose: Postiz adds platforms
  // regularly and a bare `__type` is a valid payload for most of them. Better
  // to attempt the post than to block a channel we simply have not catalogued.
  return rules[identifier] ?? {};
}

export function providerSettings(identifier: string): Record<string, unknown> {
  return { __type: identifier, ...(providerRule(identifier).defaults ?? {}) };
}

export function providerLimit(identifier: string): number | undefined {
  return providerRule(identifier).limit;
}

export function providerUnsupportedReason(identifier: string): string | undefined {
  return providerRule(identifier).unsupported;
}

/** Platform name for reviewer-facing copy, falling back to the raw identifier. */
export function providerLabel(identifier: string): string {
  return providerRule(identifier).label ?? identifier;
}
