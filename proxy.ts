import { NextRequest, NextResponse } from "next/server";
import { authConfigured, validSession } from "@/src/lib/auth";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/auth/") || ["/login", "/forgot-password", "/reset-password"].includes(request.nextUrl.pathname)) return NextResponse.next();
  if (!authConfigured()) {
    return request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Authentication is not configured" }, { status: 503 })
      : NextResponse.redirect(new URL("/login", request.url));
  }
  if (validSession(request.cookies.get("sck_session")?.value)) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?|ttf)$).*)"] };
