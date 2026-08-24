import { renderTemplateGraphic } from "@/src/design/og-graphic";
import { WorkspacePost } from "@/src/workspace/types";
import { readFrozenGraphic } from "@/src/design/frozen-graphic";
import { PostizError, postizFetch, postizJson } from "./postiz-client";
import { PostizIntegration } from "./postiz-client-types";
import { providerSettings } from "./postiz-providers";
import { composePostContent, graphicFingerprint } from "./postiz-content";
import { preflightExport, PreflightReport } from "./postiz-preflight";
import {
  PostizChannelResult,
  alreadyExported,
  contentFingerprint,
  findMedia,
  getExportRecord,
  pendingIntegrations,
  recordCreate,
  recordExport,
  recordMedia
} from "./postiz-ledger";

export type { PostizIntegration } from "./postiz-client-types";
export { PostizError } from "./postiz-client";

type PostizUpload = { id: string; path: string };
type PostizCreateResponse = { postId?: string; integration?: string }[];

export async function listPostizIntegrations(): Promise<PostizIntegration[]> {
  const integrations = await postizJson<PostizIntegration[]>("/integrations", { retry: true });
  return Array.isArray(integrations) ? integrations : [];
}

export async function testPostizConnection(): Promise<number> {
  return (await listPostizIntegrations()).filter((integration) => !integration.disabled).length;
}

async function renderGraphic(post: WorkspacePost): Promise<Uint8Array<ArrayBuffer>> {
  if (post.frozenGraphicPath) return readFrozenGraphic(post.frozenGraphicPath);
  // An approved post normally has a frozen PNG; re-render only as a safety net
  // so a missing artifact does not block the handoff.
  const rendered = await renderTemplateGraphic({
    topicHeading: post.topicHeading,
    articleTitle: post.articleTitle,
    imageUrl: post.generatedImageUrl || post.featuredImageUrl,
    graphicGuidance: post.graphicGuidance,
    sourceImageHasText: post.sourceImageHasText,
    adjustments: post.graphicAdjustments
  });
  return new Uint8Array(await rendered.arrayBuffer());
}

/** Uploads the graphic once per distinct render and reuses it on every retry. */
async function uploadGraphic(post: WorkspacePost): Promise<PostizUpload> {
  const fingerprint = graphicFingerprint(post);
  const cached = await findMedia(fingerprint);
  if (cached) return { id: cached.id, path: cached.path };

  const graphic = await renderGraphic(post);
  const form = new FormData();
  form.append("file", new Blob([graphic], { type: "image/png" }), `${post.id}.png`);
  // Safe to retry: an upload Postiz never gets referenced is inert.
  const response = await postizFetch("/upload", { method: "POST", form, timeoutMs: 60_000, retry: true });
  const payload = await response.json().catch(() => null) as PostizUpload | null;
  if (!payload?.id || !payload?.path) throw new PostizError("server", "Postiz accepted the upload but returned no media reference");
  await recordMedia(fingerprint, payload);
  return { id: payload.id, path: payload.path };
}

export type ExportOutcome = {
  postId: string;
  status: "exported" | "skipped" | "failed";
  results: PostizChannelResult[];
  reason?: string;
  /** Safe to press export again. */
  retryable?: boolean;
  /** Postiz may already hold this post; check there before retrying. */
  uncertain?: boolean;
};

export type ExportSummary = {
  preflight: PreflightReport;
  outcomes: ExportOutcome[];
  exported: string[];
  skipped: string[];
  failed: string[];
};

export type ExportInput = {
  posts: WorkspacePost[];
  integrationIds: string[];
  date: string;
  /** `draft` hands the post to Postiz without claiming the schedule slot. */
  type?: "schedule" | "now" | "draft";
};

/**
 * Hands approved posts to Postiz. Scheduling and publishing stay Postiz's job;
 * this only guarantees the handoff is complete, ordered, and never duplicated.
 */
export async function exportPostsToPostiz(input: ExportInput): Promise<ExportSummary> {
  if (!input.integrationIds.length) throw new PostizError("validation", "Select at least one Postiz channel");
  if (!input.posts.length) throw new PostizError("validation", "Select at least one approved post");

  // One lookup for the whole batch instead of one per post.
  const integrations = await listPostizIntegrations();
  const preflight = await preflightExport(input.posts, integrations, input.integrationIds);

  const outcomes: ExportOutcome[] = [];
  const blocked = new Set(preflight.blockedChannels.map((channel) => channel.integrationId));
  const usable = input.integrationIds
    .map((id) => integrations.find((integration) => integration.id === id))
    .filter((integration): integration is PostizIntegration => Boolean(integration) && !blocked.has(integration!.id));

  if (!preflight.ok) return { preflight, outcomes, exported: [], skipped: [], failed: [] };

  for (const post of input.posts) {
    const report = preflight.posts.find((entry) => entry.postId === post.id);
    if (!report?.ok) {
      const reason = report?.issues.find((issue) => issue.level === "block")?.message ?? "Did not pass preflight checks";
      outcomes.push({ postId: post.id, status: "failed", results: [], reason, retryable: false });
      continue;
    }

    const fingerprint = contentFingerprint(post);
    const existing = await getExportRecord(post.id);
    const targets = pendingIntegrations(existing, fingerprint, usable.map((integration) => integration.id));

    if (alreadyExported(existing, fingerprint, usable.map((integration) => integration.id)) || !targets.length) {
      outcomes.push({ postId: post.id, status: "skipped", results: existing?.results ?? [], reason: "Already sent to Postiz" });
      continue;
    }
    if (existing?.uncertain && existing.fingerprint === fingerprint) {
      outcomes.push({
        postId: post.id,
        status: "failed",
        results: existing.results,
        reason: "A previous attempt may have reached Postiz. Check Postiz, then send it back for review to re-export.",
        retryable: false,
        uncertain: true
      });
      continue;
    }

    const channels = usable.filter((integration) => targets.includes(integration.id));
    try {
      const upload = await uploadGraphic(post);
      const content = composePostContent(post);
      // Creates are never retried automatically: without an idempotency key on
      // Postiz's side, a blind repeat is a duplicate on a real account.
      const created = await postizJson<PostizCreateResponse>("/posts", {
        method: "POST",
        timeoutMs: 45_000,
        json: {
          type: input.type ?? "schedule",
          date: input.date,
          shortLink: false,
          tags: [],
          posts: channels.map((integration) => ({
            integration: { id: integration.id },
            value: [{ content, image: [{ id: upload.id, path: upload.path }] }],
            settings: providerSettings(integration.identifier)
          }))
        }
      });
      await recordCreate();

      const results: PostizChannelResult[] = channels.map((integration, index) => ({
        integrationId: integration.id,
        integrationName: integration.name,
        // Postiz returns one entry per channel, in the order they were sent.
        postizPostId: (Array.isArray(created) ? created.find((entry) => entry.integration === integration.id) ?? created[index] : undefined)?.postId
      }));

      const record = await recordExport({ postId: post.id, fingerprint, status: "exported", exportedAt: new Date().toISOString(), integrationIds: usable.map((integration) => integration.id), results, uncertain: false });
      outcomes.push({ postId: post.id, status: "exported", results: record.results });
    } catch (error) {
      const failure = error instanceof PostizError ? error : new PostizError("server", error instanceof Error ? error.message : "Export failed");
      // A timeout or dropped connection leaves the outcome genuinely unknown.
      const uncertain = failure.kind === "timeout" || failure.kind === "network";
      await recordExport({
        postId: post.id,
        fingerprint,
        status: "failed",
        exportedAt: new Date().toISOString(),
        integrationIds: usable.map((integration) => integration.id),
        results: [],
        lastError: failure.reviewerMessage,
        uncertain
      });
      outcomes.push({ postId: post.id, status: "failed", results: [], reason: failure.reviewerMessage, retryable: failure.transient && !uncertain, uncertain });

      // A rate limit or auth failure will hit every remaining post identically;
      // stop rather than burning the batch against a wall.
      if (failure.kind === "rate_limit" || failure.kind === "auth") {
        for (const remaining of input.posts.slice(input.posts.indexOf(post) + 1)) {
          outcomes.push({ postId: remaining.id, status: "failed", results: [], reason: failure.reviewerMessage, retryable: true });
        }
        break;
      }
    }
  }

  return {
    preflight,
    outcomes,
    exported: outcomes.filter((outcome) => outcome.status === "exported").map((outcome) => outcome.postId),
    skipped: outcomes.filter((outcome) => outcome.status === "skipped").map((outcome) => outcome.postId),
    failed: outcomes.filter((outcome) => outcome.status === "failed").map((outcome) => outcome.postId)
  };
}
