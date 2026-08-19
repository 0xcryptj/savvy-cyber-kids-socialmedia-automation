import { NextRequest, NextResponse } from "next/server";
import { regeneratePost } from "@/src/workflow/regenerate";
import { sameOrigin } from "@/src/lib/request-security";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const { id } = await params;
  try {
    return NextResponse.json(await regeneratePost(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Regeneration failed" }, { status: 422 });
  }
}
