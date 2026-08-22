import { renderTemplateGraphic } from "@/src/design/og-graphic";
import { getPostizSettings } from "@/src/config/postiz-settings";
import { WorkspacePost } from "@/src/workspace/types";
import { readFrozenGraphic } from "@/src/design/frozen-graphic";

export type PostizIntegration = {
  id: string;
  name: string;
  identifier: string;
  picture?: string;
  profile?: string;
  disabled?: boolean;
};

type PostizUpload = { id: string; path: string };
type PostizCreateResult = { postId?: string; integration?: string }[];

async function postizRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const settings = await getPostizSettings();
  if (!settings.apiKey) throw new Error("Postiz API key is not configured - set it in Settings");
  const response = await fetch(`${settings.apiUrl}${path}`, {
    ...init,
    headers: { Authorization: settings.apiKey, ...(init?.headers || {}) },
    signal: init?.signal || AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => null) as { message?: string; error?: string } | T | null;
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && ("message" in payload || "error" in payload) ? (payload.message || payload.error) : undefined;
    throw new Error(`Postiz request failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  return payload as T;
}

export async function listPostizIntegrations(): Promise<PostizIntegration[]> {
  return postizRequest<PostizIntegration[]>("/integrations");
}

async function uploadGraphic(post: WorkspacePost): Promise<PostizUpload> {
  const settings = await getPostizSettings();
  const graphic = post.frozenGraphicPath
    ? await readFrozenGraphic(post.frozenGraphicPath)
    : Buffer.from(await (await renderTemplateGraphic({ topicHeading: post.topicHeading, articleTitle: post.articleTitle, imageUrl: post.generatedImageUrl || post.featuredImageUrl, graphicGuidance: post.graphicGuidance })).arrayBuffer());
  const form = new FormData();
  form.append("file", new Blob([graphic], { type: "image/png" }), `${post.id}.png`);
  const uploaded = await fetch(`${settings.apiUrl}/upload`, { method: "POST", headers: { Authorization: settings.apiKey }, body: form, signal: AbortSignal.timeout(30_000) });
  const payload = await uploaded.json().catch(() => null) as PostizUpload | { message?: string } | null;
  if (!uploaded.ok || !payload || !("id" in payload) || !("path" in payload)) throw new Error(`Postiz media upload failed (${uploaded.status})`);
  return payload;
}

function providerSettings(identifier: string): Record<string, unknown> {
  if (identifier === "instagram" || identifier === "instagram-standalone") return { __type: identifier, post_type: "post" };
  if (identifier === "x") return { __type: identifier, who_can_reply_post: "everyone" };
  return { __type: identifier };
}

export async function schedulePostizPost(input: { post: WorkspacePost; integrationIds: string[]; date: string }): Promise<PostizCreateResult> {
  if (!input.integrationIds.length) throw new Error("Select at least one Postiz channel");
  const integrations = await listPostizIntegrations();
  const selected = integrations.filter((integration) => input.integrationIds.includes(integration.id) && !integration.disabled);
  if (selected.length !== input.integrationIds.length) throw new Error("One or more selected Postiz channels are unavailable or disabled");
  const upload = await uploadGraphic(input.post);
  const content = `${input.post.caption.trim()}\n\n${input.post.hashtags.join(" ")}`.trim();
  return postizRequest<PostizCreateResult>("/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "schedule",
      date: input.date,
      shortLink: false,
      tags: [],
      posts: selected.map((integration) => ({
        integration: { id: integration.id },
        value: [{ content, image: [{ id: upload.id, path: upload.path }] }],
        settings: providerSettings(integration.identifier)
      }))
    })
  });
}

export async function testPostizConnection(): Promise<number> {
  return (await listPostizIntegrations()).filter((integration) => !integration.disabled).length;
}
