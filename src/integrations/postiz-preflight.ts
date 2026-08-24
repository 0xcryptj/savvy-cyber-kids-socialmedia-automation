import { WorkspacePost } from "@/src/workspace/types";
import { PostizIntegration } from "./postiz-client-types";
import { providerLabel, providerLimit, providerUnsupportedReason } from "./postiz-providers";
import { composePostContent, graphicFingerprint } from "./postiz-content";
import { alreadyExported, contentFingerprint, createBudgetRemaining, listExportRecords } from "./postiz-ledger";

/**
 * Everything checkable without calling Postiz.
 *
 * The point is to fail in the dashboard, where a reviewer can fix it, rather
 * than mid-batch against the API, where half the posts are already live and the
 * rest come back as an opaque 400.
 */
export type PreflightIssue = {
  level: "block" | "warn";
  code: "unsupported_channel" | "too_long" | "no_graphic" | "empty_caption" | "duplicate" | "budget" | "channel_missing";
  message: string;
  integrationId?: string;
  /** On `too_long`, the platform's cap, so the editor can count against it. */
  limit?: number;
};

export type PostPreflight = { postId: string; title: string; ok: boolean; contentLength: number; issues: PreflightIssue[] };

export type PreflightReport = {
  ok: boolean;
  posts: PostPreflight[];
  /** Channels that cannot receive a post from this dashboard at all. */
  blockedChannels: { integrationId: string; name: string; reason: string }[];
  budget: { remaining: number; required: number; resetAt?: string };
  issues: PreflightIssue[];
};

export async function preflightExport(posts: WorkspacePost[], integrations: PostizIntegration[], integrationIds: string[]): Promise<PreflightReport> {
  const selected = integrationIds
    .map((id) => integrations.find((integration) => integration.id === id))
    .filter((integration): integration is PostizIntegration => Boolean(integration));

  const issues: PreflightIssue[] = [];
  for (const id of integrationIds) {
    if (!selected.some((integration) => integration.id === id)) {
      issues.push({ level: "block", code: "channel_missing", message: "A selected channel is no longer connected in Postiz.", integrationId: id });
    }
  }

  const blockedChannels = selected
    .map((integration) => ({ integration, reason: integration.disabled ? "This channel is disabled in Postiz." : providerUnsupportedReason(integration.identifier) }))
    .filter((entry): entry is { integration: PostizIntegration; reason: string } => Boolean(entry.reason))
    .map((entry) => ({ integrationId: entry.integration.id, name: entry.integration.name, reason: entry.reason }));

  const usableChannels = selected.filter((integration) => !blockedChannels.some((blocked) => blocked.integrationId === integration.id));
  const records = await listExportRecords(posts.map((post) => post.id));

  const postReports: PostPreflight[] = posts.map((post) => {
    const postIssues: PreflightIssue[] = [];
    const content = composePostContent(post);

    if (!content) postIssues.push({ level: "block", code: "empty_caption", message: "This post has no caption text to send." });
    if (!post.frozenGraphicPath && !graphicFingerprint(post)) postIssues.push({ level: "block", code: "no_graphic", message: "This post has no graphic to attach." });

    // Reported per platform, not per channel: three X accounts share one limit
    // and should not produce the same message three times.
    const reportedLimits = new Set<string>();
    for (const integration of usableChannels) {
      const limit = providerLimit(integration.identifier);
      if (!limit || content.length <= limit) continue;
      const label = providerLabel(integration.identifier);
      if (reportedLimits.has(label)) continue;
      reportedLimits.add(label);
      postIssues.push({
        level: "block",
        code: "too_long",
        message: `${content.length} characters. ${label} allows ${limit}, so this is ${content.length - limit} over.`,
        integrationId: integration.id,
        limit
      });
    }

    const record = records.find((entry) => entry.postId === post.id);
    if (alreadyExported(record, contentFingerprint(post), usableChannels.map((integration) => integration.id))) {
      postIssues.push({ level: "warn", code: "duplicate", message: "Already sent to these channels. Exporting again will be skipped." });
    }

    return {
      postId: post.id,
      title: post.topicHeading,
      ok: !postIssues.some((issue) => issue.level === "block"),
      contentLength: content.length,
      issues: postIssues
    };
  });

  // One create call carries every channel for a post, so the budget cost is the
  // number of posts that will actually be sent, not posts x channels.
  const required = postReports.filter((report) => report.ok && !report.issues.some((issue) => issue.code === "duplicate")).length;
  const budget = await createBudgetRemaining();
  if (required > budget.remaining) {
    issues.push({
      level: "block",
      code: "budget",
      message: `Postiz allows about ${budget.remaining} more scheduled post${budget.remaining === 1 ? "" : "s"} this hour, but ${required} are selected. Export fewer, or wait.`
    });
  }
  if (!usableChannels.length) {
    issues.push({ level: "block", code: "unsupported_channel", message: "None of the selected channels can receive a post from this dashboard." });
  }

  return {
    ok: !issues.some((issue) => issue.level === "block") && postReports.some((report) => report.ok),
    posts: postReports,
    blockedChannels,
    budget: { remaining: budget.remaining, required, resetAt: budget.resetAt },
    issues
  };
}
