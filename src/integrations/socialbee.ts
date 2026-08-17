export interface SocialBeeClient { schedule(input: { caption: string; graphicPath: string }): Promise<{ id: string }>; }
