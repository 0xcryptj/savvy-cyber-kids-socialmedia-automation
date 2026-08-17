import { contentRules } from "@/config/content-rules";
import { createMockPost, finalizeGeneratedPost } from "@/src/content/generate";
import { PostStatus } from "@/src/workflow/state";
const title = "How Connected Toys Can Help Kids Build Safer Digital Habits";
const generated = createMockPost(title);
const finalPost = finalizeGeneratedPost(generated);
export type MockPost = typeof finalPost & { id: string; status: PostStatus; sourceUrl: string; publishedAt: string; imageUrl: string; graphicPath: string };
export const pendingPost: MockPost = { ...finalPost, id: "post_demo_001", status: "PENDING_REVIEW", sourceUrl: "https://savvycyberkids.org/tech-talk/blog/", publishedAt: "August 12, 2026", imageUrl: "https://images.unsplash.com/photo-1504159506876-f8338247a14a?auto=format&fit=crop&w=1200&q=80", graphicPath: "/generated/placeholder.svg" };
export const approvedPosts: MockPost[] = [{ ...pendingPost, id: "post_demo_002", status: "APPROVED", topic_heading: "KINDNESS ONLINE", caption: "Small choices can make online spaces more welcoming. This guide gives families practical ways to encourage empathy and confidence online.", hashtags: ["#OnlineKindness", "#DigitalCitizenship", ...contentRules.hashtags.required] }];
