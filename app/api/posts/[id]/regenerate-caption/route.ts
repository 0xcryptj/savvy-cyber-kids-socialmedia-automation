import { NextRequest, NextResponse } from "next/server";
import { regenerateCaption } from "@/src/workflow/regenerate";
import { boundedText, sameOrigin } from "@/src/lib/request-security";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({})) as { reviewerGuidance?: unknown };
    return NextResponse.json(await regenerateCaption(id, boundedText(body.reviewerGuidance, 1000)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Caption regeneration failed" }, { status: 422 });
  }
}
