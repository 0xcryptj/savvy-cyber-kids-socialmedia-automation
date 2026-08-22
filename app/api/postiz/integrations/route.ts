import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/src/lib/request-security";
import { listPostizIntegrations } from "@/src/integrations/postiz";

export async function GET(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  try {
    const integrations = await listPostizIntegrations();
    return NextResponse.json({ integrations: integrations.filter((integration) => !integration.disabled) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load Postiz channels" }, { status: 502 });
  }
}
