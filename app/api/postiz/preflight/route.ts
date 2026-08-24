import { NextRequest, NextResponse } from "next/server";
import { getPost } from "@/src/workspace/store";
import { sameOrigin } from "@/src/lib/request-security";
import { PostizError, listPostizIntegrations } from "@/src/integrations/postiz";
import { preflightExport } from "@/src/integrations/postiz-preflight";
import { WorkspacePost } from "@/src/workspace/types";

/** Dry run: everything the export would check, without sending anything. */
export async function POST(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const body = await request.json().catch(() => null) as { postIds?: unknown; integrationIds?: unknown } | null;
  if (!body || !Array.isArray(body.postIds) || !Array.isArray(body.integrationIds) || !body.postIds.every((item) => typeof item === "string") || !body.integrationIds.every((item) => typeof item === "string")) {
    return NextResponse.json({ error: "Select posts and Postiz channels" }, { status: 400 });
  }
  const posts: WorkspacePost[] = [];
  for (const id of (body.postIds as string[]).slice(0, 100)) {
    const post = await getPost(id);
    if (post && post.status === "APPROVED") posts.push(post);
  }
  try {
    const integrations = await listPostizIntegrations();
    return NextResponse.json(await preflightExport(posts, integrations, body.integrationIds as string[]));
  } catch (error) {
    const failure = error instanceof PostizError ? error : null;
    return NextResponse.json({ error: failure?.reviewerMessage ?? "Could not reach Postiz" }, { status: failure?.kind === "auth" ? 401 : 502 });
  }
}
