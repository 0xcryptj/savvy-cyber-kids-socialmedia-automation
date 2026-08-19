import { NextRequest, NextResponse } from "next/server";
import { getEffectiveHandoffSettings, publicAssetUrl, publicUrlError } from "@/src/config/handoff-settings";
import { listPosts } from "@/src/workspace/store";
import { sameOrigin } from "@/src/lib/request-security";

function csvCell(value: string | undefined): string {
  return `"${(value || "").replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const originError = sameOrigin(request);
  if (originError) return originError;
  const settings = await getEffectiveHandoffSettings();
  if (!settings.appPublicUrl) return NextResponse.json({ error: publicUrlError().replace("before handing off posts", "before exporting CSV") }, { status: 400 });
  const posts = await listPosts("APPROVED");
  const rows = ["text,link,imageUrls", ...posts.map(post => {
    const text = `${post.caption}\n\n${post.hashtags.join(" ")}`;
    const graphicUrl = publicAssetUrl(post.graphicPath, settings.appPublicUrl) || "";
    return [text, post.externalUrl || post.sourceUrl, graphicUrl].map(csvCell).join(",");
  })];
  return new NextResponse(`\uFEFF${rows.join("\r\n")}\r\n`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="socialbee-approved-posts.csv"' } });
}
