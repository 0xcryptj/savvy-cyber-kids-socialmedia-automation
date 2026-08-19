import { NextRequest, NextResponse } from "next/server";

export function sameOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    const sameLoopback = loopbackHosts.has(originUrl.hostname) && loopbackHosts.has(requestUrl.hostname) && originUrl.port === requestUrl.port;
    if (originUrl.host !== requestUrl.host && !sameLoopback) {
      return NextResponse.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  return null;
}

export function boundedText(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.length <= max ? value : undefined;
}
