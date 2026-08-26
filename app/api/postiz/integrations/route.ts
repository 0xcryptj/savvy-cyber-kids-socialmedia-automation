import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/src/lib/request-security";
import { listPostizIntegrations } from "@/src/integrations/postiz";
import { getPostizSettings, postizAppUrl } from "@/src/config/postiz-settings";

export async function GET(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  try {
    const integrations = await listPostizIntegrations();
    // The queue links straight to the calendar after a handoff, so the app URL
    // travels with the channels rather than needing its own round trip.
    const appUrl = postizAppUrl((await getPostizSettings()).apiUrl);
    return NextResponse.json({ integrations: integrations.filter((integration) => !integration.disabled), appUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load Postiz channels" }, { status: 502 });
  }
}
