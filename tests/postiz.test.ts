import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { WorkspacePost } from "@/src/workspace/types";
import { providerLimit, providerSettings, providerUnsupportedReason, tightestProviderLimit } from "@/src/integrations/postiz-providers";
import { composePostContent, graphicFingerprint } from "@/src/integrations/postiz-content";
import { PostizError } from "@/src/integrations/postiz-client";
import { preflightExport } from "@/src/integrations/postiz-preflight";
import {
  alreadyExported,
  contentFingerprint,
  createBudgetRemaining,
  findMedia,
  getExportRecord,
  pendingIntegrations,
  recordCreate,
  recordExport,
  recordMedia
} from "@/src/integrations/postiz-ledger";

function post(overrides: Partial<WorkspacePost> = {}): WorkspacePost {
  return {
    id: "post_1",
    articleId: "article_1",
    category: "blog",
    status: "APPROVED",
    topicHeading: "ONLINE SAFETY",
    articleTitle: "Roblox scam targets young players",
    caption: "A new scam is targeting kids on Roblox.",
    hashtags: ["#savvycyberkids", "#cyberhero"],
    sourceUrl: "https://example.com/article",
    graphicPath: "/api/graphic/post_1",
    frozenGraphicPath: "storage/generated/post_1.png",
    publishedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

const channel = (id: string, identifier: string, name = identifier) => ({ id, name, identifier });

describe("postiz provider rules", () => {
  it("supplies the settings each platform requires", () => {
    expect(providerSettings("x")).toEqual({ __type: "x", who_can_reply_post: "everyone" });
    expect(providerSettings("instagram")).toEqual({ __type: "instagram", post_type: "post" });
    expect(providerSettings("facebook")).toEqual({ __type: "facebook" });
  });

  it("stays permissive for platforms it has not catalogued", () => {
    expect(providerSettings("some-new-network")).toEqual({ __type: "some-new-network" });
    expect(providerLimit("some-new-network")).toBeUndefined();
    expect(providerUnsupportedReason("some-new-network")).toBeUndefined();
  });

  it("flags platforms this dashboard cannot build a valid payload for", () => {
    // These would otherwise come back as an opaque 400 mid-batch.
    expect(providerUnsupportedReason("youtube")).toBeTruthy();
    expect(providerUnsupportedReason("pinterest")).toBeTruthy();
    expect(providerUnsupportedReason("reddit")).toBeTruthy();
    expect(providerUnsupportedReason("discord")).toBeTruthy();
  });
});

describe("postiz content", () => {
  it("joins caption and hashtags the way the export sends them", () => {
    expect(composePostContent(post())).toBe("A new scam is targeting kids on Roblox.\n\n#savvycyberkids #cyberhero");
  });

  it("omits the blank line when there are no hashtags", () => {
    expect(composePostContent(post({ hashtags: [] }))).toBe("A new scam is targeting kids on Roblox.");
  });

  it("keeps the graphic fingerprint stable across caption-only edits", () => {
    expect(graphicFingerprint(post({ caption: "Rewritten caption" }))).toBe(graphicFingerprint(post()));
  });

  it("changes the graphic fingerprint when the composition changes", () => {
    expect(graphicFingerprint(post({ graphicAdjustments: { focusX: 0.2 } as never }))).not.toBe(graphicFingerprint(post()));
  });
});

describe("postiz errors", () => {
  it("treats rate limits and outages as worth retrying, and bad input as not", () => {
    expect(new PostizError("rate_limit", "slow down").transient).toBe(true);
    expect(new PostizError("server", "boom").transient).toBe(true);
    expect(new PostizError("validation", "bad field").transient).toBe(false);
    expect(new PostizError("auth", "nope").transient).toBe(false);
  });

  it("turns a rate limit into a reviewer-facing wait", () => {
    expect(new PostizError("rate_limit", "429", { retryAfterMs: 12 * 60_000 }).reviewerMessage).toContain("12 minutes");
  });
});

describe("export idempotency", () => {
  it("changes the content fingerprint when a reviewer edits the caption", () => {
    expect(contentFingerprint(post({ caption: "Different" }))).not.toBe(contentFingerprint(post()));
  });

  it("ignores schedule time, so re-sending the same content is still a duplicate", () => {
    expect(contentFingerprint(post({ scheduledAt: "2026-05-05T00:00:00.000Z" }))).toBe(contentFingerprint(post()));
  });

  const record = (results: string[], fingerprint: string) => ({
    postId: "post_1",
    fingerprint,
    status: "exported" as const,
    exportedAt: "2026-01-01T00:00:00.000Z",
    integrationIds: results,
    results: results.map((id) => ({ integrationId: id, integrationName: id, postizPostId: `postiz_${id}` })),
    attempts: 1
  });

  it("recognises content already delivered to every requested channel", () => {
    const fingerprint = contentFingerprint(post());
    expect(alreadyExported(record(["a", "b"], fingerprint), fingerprint, ["a", "b"])).toBe(true);
  });

  it("does not treat edited content as already exported", () => {
    expect(alreadyExported(record(["a"], "old-fingerprint"), contentFingerprint(post()), ["a"])).toBe(false);
  });

  it("re-sends only the channels a partial export missed", () => {
    const fingerprint = contentFingerprint(post());
    expect(pendingIntegrations(record(["a"], fingerprint), fingerprint, ["a", "b"])).toEqual(["b"]);
  });

  it("sends every channel when the content changed", () => {
    expect(pendingIntegrations(record(["a"], "old"), contentFingerprint(post()), ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("ledger persistence", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "postiz-ledger-"));
    process.env.POSTIZ_LEDGER_PATH = path.join(directory, "exports.json");
  });

  afterEach(async () => {
    delete process.env.POSTIZ_LEDGER_PATH;
    delete process.env.POSTIZ_CREATE_BUDGET;
    await rm(directory, { recursive: true, force: true });
  });

  it("accumulates channel results across attempts so a partial success is never re-sent", async () => {
    const fingerprint = contentFingerprint(post());
    const base = { postId: "post_1", fingerprint, exportedAt: "2026-01-01T00:00:00.000Z", integrationIds: ["a", "b"] };
    await recordExport({ ...base, status: "failed", results: [{ integrationId: "a", integrationName: "A", postizPostId: "postiz_a" }] });
    const second = await recordExport({ ...base, status: "exported", results: [{ integrationId: "b", integrationName: "B", postizPostId: "postiz_b" }] });

    expect(second.results.map((result) => result.integrationId).sort()).toEqual(["a", "b"]);
    expect(second.attempts).toBe(2);
    expect(alreadyExported(second, fingerprint, ["a", "b"])).toBe(true);
  });

  it("drops earlier results once the content is edited", async () => {
    const base = { postId: "post_1", exportedAt: "2026-01-01T00:00:00.000Z", integrationIds: ["a"], status: "exported" as const };
    await recordExport({ ...base, fingerprint: "first", results: [{ integrationId: "a", integrationName: "A", postizPostId: "postiz_a" }] });
    const edited = await recordExport({ ...base, fingerprint: "second", results: [] });
    expect(edited.results).toEqual([]);
    expect(edited.attempts).toBe(1);
  });

  it("reuses an uploaded graphic instead of uploading it again", async () => {
    await recordMedia("graphic-1", { id: "media_1", path: "https://uploads.postiz.com/a.png" });
    expect(await findMedia("graphic-1")).toMatchObject({ id: "media_1" });
    expect(await findMedia("graphic-2")).toBeUndefined();
  });

  it("spends the hourly create budget as posts go out", async () => {
    process.env.POSTIZ_CREATE_BUDGET = "3";
    expect((await createBudgetRemaining()).remaining).toBe(3);
    await recordCreate();
    await recordCreate();
    const budget = await createBudgetRemaining();
    expect(budget.remaining).toBe(1);
    expect(budget.resetAt).toBeTruthy();
  });

  it("round-trips a record through the file", async () => {
    await recordExport({ postId: "post_9", fingerprint: "f", status: "exported", exportedAt: "2026-01-01T00:00:00.000Z", integrationIds: ["a"], results: [] });
    expect(await getExportRecord("post_9")).toMatchObject({ postId: "post_9", status: "exported" });
  });
});

describe("preflight", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "postiz-preflight-"));
    process.env.POSTIZ_LEDGER_PATH = path.join(directory, "exports.json");
  });

  afterEach(async () => {
    delete process.env.POSTIZ_LEDGER_PATH;
    delete process.env.POSTIZ_CREATE_BUDGET;
    await rm(directory, { recursive: true, force: true });
  });

  it("passes a normal post to a supported channel", async () => {
    const report = await preflightExport([post()], [channel("i1", "facebook")], ["i1"]);
    expect(report.ok).toBe(true);
    expect(report.posts[0].issues).toEqual([]);
    expect(report.budget.required).toBe(1);
  });

  it("blocks a caption that exceeds the platform limit", async () => {
    const long = post({ caption: "x".repeat(400) });
    const report = await preflightExport([long], [channel("i1", "x", "X")], ["i1"]);
    expect(report.posts[0].ok).toBe(false);
    expect(report.posts[0].issues[0]).toMatchObject({ code: "too_long", integrationId: "i1" });
  });

  it("excludes a channel this dashboard cannot build a payload for", async () => {
    const report = await preflightExport([post()], [channel("i1", "pinterest", "Pinterest")], ["i1"]);
    expect(report.blockedChannels[0]).toMatchObject({ integrationId: "i1" });
    expect(report.ok).toBe(false);
  });

  it("still exports to the good channel when another is unsupported", async () => {
    const report = await preflightExport([post()], [channel("i1", "pinterest"), channel("i2", "facebook")], ["i1", "i2"]);
    expect(report.blockedChannels.map((entry) => entry.integrationId)).toEqual(["i1"]);
    expect(report.ok).toBe(true);
  });

  it("reports a channel that vanished from Postiz", async () => {
    const report = await preflightExport([post()], [channel("i1", "facebook")], ["i1", "gone"]);
    expect(report.issues.some((issue) => issue.code === "channel_missing")).toBe(true);
  });

  it("blocks a post with no caption", async () => {
    const report = await preflightExport([post({ caption: "   ", hashtags: [] })], [channel("i1", "facebook")], ["i1"]);
    expect(report.posts[0].issues[0]).toMatchObject({ code: "empty_caption" });
  });

  it("warns rather than blocks when the content already went out", async () => {
    const fingerprint = contentFingerprint(post());
    await recordExport({ postId: "post_1", fingerprint, status: "exported", exportedAt: "2026-01-01T00:00:00.000Z", integrationIds: ["i1"], results: [{ integrationId: "i1", integrationName: "F", postizPostId: "p" }] });
    const report = await preflightExport([post()], [channel("i1", "facebook")], ["i1"]);
    expect(report.posts[0].ok).toBe(true);
    expect(report.posts[0].issues[0]).toMatchObject({ level: "warn", code: "duplicate" });
    // A duplicate costs no create call, so it does not consume budget.
    expect(report.budget.required).toBe(0);
  });

  it("stops a batch that would exceed the hourly create limit", async () => {
    process.env.POSTIZ_CREATE_BUDGET = "1";
    const posts = [post({ id: "a" }), post({ id: "b" })];
    const report = await preflightExport(posts, [channel("i1", "facebook")], ["i1"]);
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === "budget")).toBe(true);
  });
});

describe("the binding character limit", () => {
  it("is the strictest channel selected, not the roomiest", () => {
    expect(tightestProviderLimit(["facebook", "x", "linkedin"])).toEqual({ label: "X", limit: 280 });
  });

  it("names the platform doing the constraining", () => {
    expect(tightestProviderLimit(["facebook", "bluesky"])).toEqual({ label: "Bluesky", limit: 300 });
  });

  it("ignores channels with no published limit", () => {
    expect(tightestProviderLimit(["youtube", "linkedin"])).toEqual({ label: "LinkedIn", limit: 3_000 });
    expect(tightestProviderLimit(["youtube", "tiktok"])).toBeUndefined();
    expect(tightestProviderLimit([])).toBeUndefined();
  });
});
