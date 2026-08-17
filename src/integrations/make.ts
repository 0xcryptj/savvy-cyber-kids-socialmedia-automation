export interface MakeHandoff { sendApprovedPost(input: { postId: string; caption: string; hashtags: string[]; graphicPath?: string }): Promise<{ accepted: boolean; externalId?: string }>; }
export class ConfiguredMakeHandoff implements MakeHandoff {
  async sendApprovedPost(input: { postId: string; caption: string; hashtags: string[]; graphicPath?: string }) {
    const webhook = process.env.MAKE_WEBHOOK_URL;
    if (!webhook) throw new Error("MAKE_WEBHOOK_URL is not configured");
    const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, caption: `${input.caption}\n\n${input.hashtags.join(" ")}` }) });
    if (!response.ok) throw new Error(`Make.com handoff failed (${response.status})`);
    return { accepted: true, externalId: response.headers.get("x-make-execution-id") || undefined };
  }
}
