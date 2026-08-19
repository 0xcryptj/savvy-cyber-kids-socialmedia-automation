import { NextRequest, NextResponse } from "next/server";
import { PostStatus } from "@/src/workflow/state";
import { transitionPost } from "@/src/workflow/approval";
import { getPost, savePost } from "@/src/workspace/store";
import { boundedText, sameOrigin } from "@/src/lib/request-security";
import { validateEditableHashtags } from "@/src/content/validate";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(post);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const { id } = await params;
  const body = await request.json() as { status?: PostStatus; caption?: string; hashtags?: unknown };
  if (body.caption !== undefined && !boundedText(body.caption, 10000)) return NextResponse.json({ error: "Caption is too long" }, { status: 400 });
  try {
    const hashtags = body.hashtags === undefined ? undefined : validateEditableHashtags(body.hashtags);
    const patch = { ...(body.caption !== undefined ? { caption: body.caption } : {}), ...(hashtags ? { hashtags } : {}) };
    if (body.status) {
      return NextResponse.json(await transitionPost(id, body.status, Object.keys(patch).length ? patch : undefined));
    }
    const post = await getPost(id);
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(await savePost({ ...post, ...patch }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 400 });
  }
}
