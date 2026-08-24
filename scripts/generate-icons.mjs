/**
 * Regenerates app/components/brands.ts from simple-icons (CC0).
 *
 * Run after adding a platform to postiz-providers so its mark shows up in the
 * channel list. Brands simple-icons does not carry fall back to a lettermark.
 */
import { writeFileSync } from "fs";
import * as si from "simple-icons";

const map = {
  x: "siX", instagram: "siInstagram", "instagram-standalone": "siInstagram", facebook: "siFacebook",
  threads: "siThreads", bluesky: "siBluesky", mastodon: "siMastodon", telegram: "siTelegram",
  pinterest: "siPinterest", reddit: "siReddit", discord: "siDiscord", tiktok: "siTiktok",
  youtube: "siYoutube", farcaster: "siFarcaster", warpcast: "siFarcaster",
  mattermost: "siMattermost", mattermost_provider: "siMattermost", postiz: "siPostiz"
};

const entries = Object.entries(map).flatMap(([id, key]) => {
  const icon = si[key];
  if (!icon) { console.warn(`simple-icons has no ${key}; ${id} will use a lettermark`); return []; }
  const name = /^[a-z][a-z0-9]*$/.test(id) ? id : JSON.stringify(id);
  return [`  ${name}: { title: ${JSON.stringify(icon.title)}, hex: "#${icon.hex}", path: ${JSON.stringify(icon.path)} }`];
});

writeFileSync("app/components/brands.ts", `/**
 * Official brand marks for the platforms we hand posts to.
 *
 * Paths come from simple-icons (CC0), inlined here rather than imported so the
 * bundle carries only the handful of brands we actually show. Regenerate with
 * \`npm run icons:generate\` after adding a platform to postiz-providers.
 *
 * LinkedIn and Slack are deliberately absent: both were removed from
 * simple-icons at those companies' request, so they fall back to a neutral
 * lettermark instead of a reproduction of a mark they asked to have pulled.
 */
export type Brand = { title: string; hex: string; path: string };

export const brands: Record<string, Brand> = {
${entries.join(",\n")}
};

/** Brand colour for platforms we draw a lettermark for. */
export const lettermarkColors: Record<string, string> = {
  linkedin: "#0A66C2",
  "linkedin-page": "#0A66C2",
  slack: "#611F69"
};
`);
console.log(`wrote ${entries.length} brands`);
