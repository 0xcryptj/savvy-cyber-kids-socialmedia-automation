import { NextRequest, NextResponse } from "next/server";
import { getPost } from "@/src/workspace/store";
import { sameOrigin } from "@/src/lib/request-security";
import { PostizError, exportPostsToPostiz } from "@/src/integrations/postiz";
import { applyExportOutcomes } from "@/src/workflow/postiz-export";

/** Single-post export. Shares the batch path so idempotency behaves identically. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { integrationIds?: unknown; date?: unknown } | null;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.status !== "APPROVED") return NextResponse.json({ error: "Only approved posts can be handed off" }, { status: 400 });
  if (!body || !Array.isArray(body.integrationIds) || !body.integrationIds.length || !body.integrationIds.every((item) => typeof item === "string") || typeof body.date !== "string") {
    return NextResponse.json({ error: "Choose Postiz channels and a schedule time" }, { status: 400 });
  }
  const scheduleDate = new Date(body.date);
  if (Number.isNaN(scheduleDate.getTime()) || scheduleDate.getTime() <= Date.now()) return NextResponse.json({ error: "Choose a future schedule time" }, { status: 400 });

  try {
    const summary = await exportPostsToPostiz({ posts: [post], integrationIds: body.integrationIds as string[], date: scheduleDate.toISOString(), type: "schedule" });
    await applyExportOutcomes(summary, { date: scheduleDate.toISOString(), type: "schedule" });
    const outcome = summary.outcomes[0];
    if (!outcome || outcome.status === "failed") {
      const reason = outcome?.reason ?? summary.preflight.issues.find((issue) => issue.level === "block")?.message ?? "Handoff failed";
      return NextResponse.json({ error: reason, outcome, preflight: summary.preflight }, { status: 400 });
    }
    const updated = await getPost(id);
    return NextResponse.json({ ...updated, outcome });
  } catch (error) {
    const failure = error instanceof PostizError ? error : null;
    return NextResponse.json({ error: failure?.reviewerMessage ?? (error instanceof Error ? error.message : "Handoff failed") }, { status: failure?.kind === "auth" ? 401 : 502 });
  }
}
