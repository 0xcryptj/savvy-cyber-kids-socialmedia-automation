import { socialPlatforms } from "@/config/platforms";
import { publishingUrls } from "@/config/urls";

export interface SocialBeeClient {
  schedule(input: { caption: string; graphicPath: string }): Promise<{ id: string }>;
}

export function socialBeePackage(input: { caption: string; hashtags: string[]; graphicPath: string }) {
  return {
    caption: `${input.caption}\n\n${input.hashtags.join(" ")}`,
    graphicPath: input.graphicPath,
    schedulerUrl: publishingUrls.socialBee,
    platforms: socialPlatforms.map((platform) => platform.label)
  };
}

export class ManualSocialBeeClient implements SocialBeeClient {
  async schedule(input: { caption: string; graphicPath: string }) {
    return { id: `socialbee_manual_${Date.now()}`, ...socialBeePackage({ ...input, hashtags: [] }) };
  }
}
