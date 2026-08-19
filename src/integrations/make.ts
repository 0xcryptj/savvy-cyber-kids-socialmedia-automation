export interface MakeHandoff { sendApprovedPost(input: { postId: string; caption: string; hashtags: string[]; graphicPath?: string }): Promise<{ accepted: boolean; externalId?: string }>; }

function publicAssetUrl(graphicPath?: string): string | undefined {
  if (!graphicPath) return undefined;
  if (/^https?:\/\//i.test(graphicPath)) return graphicPath;
  const publicOrigin = process.env.APP_PUBLIC_URL?.trim();
  if (!publicOrigin) return undefined;
  try {
    return new URL(graphicPath, publicOrigin).toString();
  } catch {
    return undefined;
  }
}

export class ConfiguredMakeHandoff implements MakeHandoff {
  async sendApprovedPost(input: { postId: string; caption: string; hashtags: string[]; graphicPath?: string }) {
    const webhook = process.env.MAKE_WEBHOOK_URL;
    if (!webhook) throw new Error("MAKE_WEBHOOK_URL is not configured");
    const caption = `${input.caption}\n\n${input.hashtags.join(" ")}`;
    const graphicUrl = publicAssetUrl(input.graphicPath);
    const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      postId: input.postId,
      caption,
      hashtags: input.hashtags,
      graphicPath: input.graphicPath,
      graphicUrl,
      mediaUrl: graphicUrl,
      source: "savvy-cyber-kids-local-workspace",
      socialBeeWorkspaceId: process.env.SOCIALBEE_WORKSPACE_ID || undefined
    }) });
    if (!response.ok) throw new Error(`Make.com handoff failed (${response.status})`);
    return { accepted: true, externalId: response.headers.get("x-make-execution-id") || undefined };
  }
}
