import { NextRequest, NextResponse } from "next/server";
import { transitionPost } from "@/src/workflow/approval";
import { getPost } from "@/src/workspace/store";
import { sameOrigin } from "@/src/lib/request-security";
import { schedulePostizPost } from "@/src/integrations/postiz";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { integrationIds?: unknown; date?: unknown } | null;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.status !== "APPROVED") return NextResponse.json({ error: "Only approved posts can be handed off" }, { status: 400 });
  if (!body || !Array.isArray(body.integrationIds) || !body.integrationIds.every((item) => typeof item === "string") || typeof body.date !== "string") return NextResponse.json({ error: "Choose Postiz channels and a schedule time" }, { status: 400 });
  const scheduleDate = new Date(body.date);
  if (Number.isNaN(scheduleDate.getTime()) || scheduleDate.getTime() <= Date.now()) return NextResponse.json({ error: "Choose a future schedule time" }, { status: 400 });
  try {
    const result = await schedulePostizPost({ post, integrationIds: body.integrationIds, date: scheduleDate.toISOString() });
    const queued = await transitionPost(id, "QUEUED", { publishedVia: "Postiz" });
    const scheduled = await transitionPost(id, "SCHEDULED", { publishedVia: "Postiz", publishExternalId: result[0]?.postId, scheduledAt: scheduleDate.toISOString() });
    return NextResponse.json({ ...scheduled, queuedAt: queued.queuedAt });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Handoff failed";
    const failed = await transitionPost(id, "FAILED", { failureReason: reason });
    return NextResponse.json({ error: reason, post: failed }, { status: 400 });
  }
}
