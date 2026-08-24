import { NextRequest, NextResponse } from "next/server";
import { getPost } from "@/src/workspace/store";
import { sameOrigin } from "@/src/lib/request-security";
import { PostizError, exportPostsToPostiz } from "@/src/integrations/postiz";
import { listExportRecords } from "@/src/integrations/postiz-ledger";
import { applyExportOutcomes } from "@/src/workflow/postiz-export";
import { WorkspacePost } from "@/src/workspace/types";

const exportTypes = new Set(["schedule", "now", "draft"]);

function parseBody(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { postIds, integrationIds, date, type } = body as Record<string, unknown>;
  if (!Array.isArray(postIds) || !postIds.length || postIds.length > 100 || !postIds.every((item) => typeof item === "string")) return null;
  if (!Array.isArray(integrationIds) || !integrationIds.length || !integrationIds.every((item) => typeof item === "string")) return null;
  if (typeof date !== "string") return null;
  if (type !== undefined && (typeof type !== "string" || !exportTypes.has(type))) return null;
  return { postIds: postIds as string[], integrationIds: integrationIds as string[], date, type: (type as "schedule" | "now" | "draft") ?? "schedule" };
}

/** Export status for the approved queue, so the UI can show what already went out. */
export async function GET(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const ids = request.nextUrl.searchParams.get("postIds");
  const records = await listExportRecords(ids ? ids.split(",").filter(Boolean).slice(0, 200) : undefined);
  return NextResponse.json({ records });
}

export async function POST(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "Select posts, Postiz channels, and a schedule time" }, { status: 400 });

  const scheduleDate = new Date(parsed.date);
  if (Number.isNaN(scheduleDate.getTime())) return NextResponse.json({ error: "Choose a valid schedule time" }, { status: 400 });
  // Postiz needs a date even for a draft, but only a real schedule has to be in
  // the future.
  if (parsed.type === "schedule" && scheduleDate.getTime() <= Date.now()) return NextResponse.json({ error: "Choose a future schedule time" }, { status: 400 });

  const posts: WorkspacePost[] = [];
  const rejected: Array<{ id: string; error: string }> = [];
  for (const id of parsed.postIds) {
    const post = await getPost(id);
    if (!post) rejected.push({ id, error: "Post not found" });
    else if (post.status !== "APPROVED") rejected.push({ id, error: "Only approved posts can be exported" });
    else posts.push(post);
  }
  if (!posts.length) return NextResponse.json({ error: rejected[0]?.error ?? "Nothing to export", rejected }, { status: 400 });

  try {
    const summary = await exportPostsToPostiz({ posts, integrationIds: parsed.integrationIds, date: scheduleDate.toISOString(), type: parsed.type });
    await applyExportOutcomes(summary, { date: scheduleDate.toISOString(), type: parsed.type });
    const blocking = summary.preflight.issues.find((issue) => issue.level === "block");
    return NextResponse.json({
      exported: summary.exported,
      skipped: summary.skipped,
      failed: summary.failed,
      outcomes: summary.outcomes,
      preflight: summary.preflight,
      rejected,
      ...(summary.preflight.ok ? {} : { error: blocking?.message ?? "Export did not pass preflight checks" })
    }, { status: summary.preflight.ok ? 200 : 400 });
  } catch (error) {
    const failure = error instanceof PostizError ? error : null;
    return NextResponse.json({ error: failure?.reviewerMessage ?? (error instanceof Error ? error.message : "Export failed") }, { status: failure?.kind === "auth" ? 401 : 502 });
  }
}
