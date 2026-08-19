import { NextRequest, NextResponse } from "next/server";
import { transitionPost } from "@/src/workflow/approval";
import { getPost } from "@/src/workspace/store";
import { ConfiguredMakeHandoff } from "@/src/integrations/make";
import { sameOrigin } from "@/src/lib/request-security";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originError = sameOrigin(_);
  if (originError) return originError;
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.status !== "APPROVED") return NextResponse.json({ error: "Only approved posts can be handed off" }, { status: 400 });
  try {
    const result = await new ConfiguredMakeHandoff().sendApprovedPost({ postId: post.id, caption: post.caption, hashtags: post.hashtags, graphicPath: post.graphicPath });
    return NextResponse.json(await transitionPost(id, "PUBLISHED", { publishedVia: "Make.com", publishExternalId: result.externalId }));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Handoff failed";
    const failed = await transitionPost(id, "FAILED", { failureReason: reason });
    return NextResponse.json({ error: reason, post: failed }, { status: 400 });
  }
}
