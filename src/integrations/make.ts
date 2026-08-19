import { getEffectiveHandoffSettings, publicAssetUrl, publicUrlError } from "@/src/config/handoff-settings";

export interface MakeHandoff { sendApprovedPost(input: { postId: string; caption: string; hashtags: string[]; graphicPath?: string }): Promise<{ accepted: boolean; externalId?: string }>; }

export class ConfiguredMakeHandoff implements MakeHandoff {
  async sendApprovedPost(input: { postId: string; caption: string; hashtags: string[]; graphicPath?: string }) {
    const settings = await getEffectiveHandoffSettings();
    const webhook = settings.makeWebhookUrl;
    if (!webhook) throw new Error("Make.com Webhook URL is not configured - set it in Settings before handing off posts");
    if (!settings.appPublicUrl) throw new Error(publicUrlError());
    const caption = `${input.caption}\n\n${input.hashtags.join(" ")}`;
    const graphicUrl = publicAssetUrl(input.graphicPath, settings.appPublicUrl);
    const payload = {
      postId: input.postId,
      caption,
      hashtags: input.hashtags,
      graphicPath: input.graphicPath,
      graphicUrl,
      mediaUrl: graphicUrl,
      source: "savvy-cyber-kids-local-workspace",
      socialBeeWorkspaceId: process.env.SOCIALBEE_WORKSPACE_ID || undefined
    };
    let lastError = "Make.com handoff failed";
    for (let attempt = 0; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) });
        if (response.ok) return { accepted: true, externalId: response.headers.get("x-make-execution-id") || undefined };
        lastError = `Make.com handoff failed (${response.status})`;
        if (response.status >= 400 && response.status < 500) {
          throw Object.assign(new Error(lastError), { nonRetryable: true });
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;
        if (typeof error === "object" && error !== null && "nonRetryable" in error) break;
        if (attempt === 2) break;
      }
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }
    throw new Error(`${lastError} after 3 attempts`);
  }
}
