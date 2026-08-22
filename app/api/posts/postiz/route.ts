import { NextRequest, NextResponse } from "next/server";
import { transitionPost } from "@/src/workflow/approval";
import { getPost } from "@/src/workspace/store";
import { sameOrigin } from "@/src/lib/request-security";
import { schedulePostizPost } from "@/src/integrations/postiz";

export async function POST(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const body = await request.json().catch(() => null) as { postIds?: unknown; integrationIds?: unknown; date?: unknown } | null;
  if (!body || !Array.isArray(body.postIds) || !body.postIds.length || body.postIds.length > 100 || !body.postIds.every((item) => typeof item === "string") || !Array.isArray(body.integrationIds) || !body.integrationIds.length || !body.integrationIds.every((item) => typeof item === "string") || typeof body.date !== "string") {
    return NextResponse.json({ error: "Select posts, Postiz channels, and a schedule time" }, { status: 400 });
  }
  const scheduleDate = new Date(body.date);
  if (Number.isNaN(scheduleDate.getTime()) || scheduleDate.getTime() <= Date.now()) return NextResponse.json({ error: "Choose a future schedule time" }, { status: 400 });

  const scheduled: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  for (const id of body.postIds) {
    const post = await getPost(id);
    if (!post) { failed.push({ id, error: "Post not found" }); continue; }
    if (post.status !== "APPROVED") { failed.push({ id, error: "Only approved posts can be scheduled" }); continue; }
    try {
      const result = await schedulePostizPost({ post, integrationIds: body.integrationIds, date: scheduleDate.toISOString() });
      await transitionPost(id, "QUEUED", { publishedVia: "Postiz" });
      await transitionPost(id, "SCHEDULED", { publishedVia: "Postiz", publishExternalId: result[0]?.postId, scheduledAt: scheduleDate.toISOString() });
      scheduled.push(id);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Scheduling failed";
      await transitionPost(id, "FAILED", { failureReason: reason });
      failed.push({ id, error: reason });
    }
  }
  return NextResponse.json({ scheduled, failed }, { status: failed.length && !scheduled.length ? 400 : 200 });
}
