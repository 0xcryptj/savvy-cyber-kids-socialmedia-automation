import { ContentCategory } from "@/config/feeds";
import { PostStatus } from "@/src/workflow/state";

export type WorkspacePost = {
  id: string;
  articleId: string;
  category: ContentCategory;
  status: PostStatus;
  topicHeading: string;
  articleTitle: string;
  caption: string;
  hashtags: string[];
  sourceUrl: string;
  externalUrl?: string;
  featuredImageUrl?: string;
  generatedImageUrl?: string;
  graphicPath: string;
  publishedAt: string;
  createdAt: string;
  approvedAt?: string;
  queuedAt?: string;
  scheduledAt?: string;
  publishedVia?: string;
  publishExternalId?: string;
};

export type WorkspaceFeedback = {
  postId: string;
  category: ContentCategory;
  status: "APPROVED" | "REJECTED";
  topicHeading: string;
  articleTitle: string;
  note?: string;
  createdAt: string;
};

export type WorkspaceState = { posts: WorkspacePost[]; feedback?: WorkspaceFeedback[] };
