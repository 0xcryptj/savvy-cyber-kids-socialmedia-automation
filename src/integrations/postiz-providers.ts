/**
 * What each Postiz provider needs in a create-post payload.
 *
 * Postiz validates `settings` per platform and rejects the whole batch with a
 * 400 when a required field is missing, so anything we cannot derive from an
 * approved post is declared here and caught in preflight instead. Sourced from
 * docs.postiz.com/public-api/providers/*.
 */
export type ProviderRule = {
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
  x: { defaults: { who_can_reply_post: "everyone" }, limit: 280 },
  facebook: { limit: 63_206 },
  instagram: { defaults: { post_type: "post" }, limit: 2_200 },
  "instagram-standalone": { defaults: { post_type: "post" }, limit: 2_200 },
  linkedin: { limit: 3_000 },
  "linkedin-page": { limit: 3_000 },
  threads: { limit: 500 },
  mastodon: { limit: 500 },
  bluesky: { limit: 300 },
  telegram: { limit: 4_096 },
  slack: { limit: 3_000 },
  warpcast: { limit: 320 },
  farcaster: { limit: 320 },
  mattermost: { limit: 16_383 },
  mattermost_provider: { limit: 16_383 },

  // Video platforms: the branded template renders a 4:5 PNG, not a video.
  youtube: { unsupported: "YouTube needs a video upload and a title. Post it from Postiz directly." },
  tiktok: { unsupported: "TikTok needs a video upload. Post it from Postiz directly." },

  // Require an account-specific target we have no way to look up from here.
  pinterest: { unsupported: "Pinterest needs a board ID. Post it from Postiz directly." },
  reddit: { unsupported: "Reddit needs a subreddit and post title. Post it from Postiz directly." },
  discord: { unsupported: "Discord needs a channel ID. Post it from Postiz directly." }
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
