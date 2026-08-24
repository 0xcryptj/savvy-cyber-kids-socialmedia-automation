import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import http from "http";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { exportPostsToPostiz } from "@/src/integrations/postiz";
import { WorkspacePost } from "@/src/workspace/types";

/**
 * Exercises the export path against a stand-in Postiz. These are the failures
 * that would otherwise only show up against a real account, where the cost of
 * getting it wrong is a duplicate post on a live channel.
 */
const graphicPath = "storage/generated/postiz_export_test.png";

let server: http.Server;
let scratch: string;
const counts = { creates: 0, uploads: 0, integrations: 0 };
let failNextCreate: number | null = null;

function handler(request: http.IncomingMessage, response: http.ServerResponse) {
  const url = request.url || "";
  const json = (body: unknown) => { response.setHeader("content-type", "application/json"); response.end(JSON.stringify(body)); };

  if (url.endsWith("/integrations")) {
    counts.integrations += 1;
    return json([
      { id: "fb", name: "SCK Facebook", identifier: "facebook" },
      { id: "ig", name: "SCK Instagram", identifier: "instagram" },
      { id: "pin", name: "SCK Pinterest", identifier: "pinterest" },
      { id: "off", name: "Old X", identifier: "x", disabled: true }
    ]);
  }
  if (url.endsWith("/upload")) {
    counts.uploads += 1;
    request.resume();
    return request.on("end", () => json({ id: `media_${counts.uploads}`, path: `https://uploads.example/${counts.uploads}.png` }));
  }
  if (url.endsWith("/posts")) {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk as Buffer));
    return request.on("end", () => {
      if (failNextCreate !== null) {
        const status = failNextCreate;
        failNextCreate = null;
        response.writeHead(status, { "content-type": "application/json", ...(status === 429 ? { "retry-after": "1800" } : {}) });
        return response.end(JSON.stringify({ message: status === 429 ? "Too many requests" : "Bad payload" }));
      }
      counts.creates += 1;
      const payload = JSON.parse(Buffer.concat(chunks).toString()) as { posts: { integration: { id: string } }[] };
      return json(payload.posts.map((entry) => ({ postId: `pz_${entry.integration.id}_${counts.creates}`, integration: entry.integration.id })));
    });
  }
  response.writeHead(404).end("{}");
}

beforeAll(async () => {
  scratch = await mkdtemp(path.join(tmpdir(), "postiz-export-"));
  process.env.POSTIZ_LEDGER_PATH = path.join(scratch, "exports.json");
  // Point settings at a scratch file too: a real saved apiUrl would otherwise
  // win over the env var below and send these tests at the live API.
  process.env.POSTIZ_SETTINGS_PATH = path.join(scratch, "settings.json");
  process.env.POSTIZ_API_KEY = "test-key";
  process.env.POSTIZ_CREATE_BUDGET = "50";
  await mkdir("storage/generated", { recursive: true });
  await writeFile(graphicPath, Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"));
  server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  process.env.POSTIZ_API_URL = `http://localhost:${(server.address() as { port: number }).port}/public/v1`;
});

afterAll(async () => {
  server.close();
  await rm(graphicPath, { force: true });
  await rm(scratch, { recursive: true, force: true });
  delete process.env.POSTIZ_LEDGER_PATH;
  delete process.env.POSTIZ_SETTINGS_PATH;
  delete process.env.POSTIZ_API_KEY;
  delete process.env.POSTIZ_API_URL;
  delete process.env.POSTIZ_CREATE_BUDGET;
});

afterEach(() => { failNextCreate = null; });

function post(overrides: Partial<WorkspacePost> = {}): WorkspacePost {
  return {
    id: "export_1", articleId: "a1", category: "blog", status: "APPROVED",
    topicHeading: "ONLINE SAFETY", articleTitle: "Roblox scam targets young players",
    caption: "A new scam is targeting kids on Roblox.", hashtags: ["#savvycyberkids"],
    sourceUrl: "https://example.com/a", graphicPath: "/api/graphic/export_1",
    frozenGraphicPath: graphicPath, publishedAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

const future = () => new Date(Date.now() + 3_600_000).toISOString();
const channels = ["fb", "ig", "pin"];

describe("exporting to postiz", () => {
  it("sends supported channels and records a postiz id for each", async () => {
    const summary = await exportPostsToPostiz({ posts: [post()], integrationIds: channels, date: future() });
    expect(summary.exported).toEqual(["export_1"]);
    expect(summary.outcomes[0].results).toHaveLength(2);
    expect(summary.outcomes[0].results.every((result) => result.postizPostId)).toBe(true);
  });

  it("excludes a channel it cannot build a payload for instead of failing the batch", async () => {
    const summary = await exportPostsToPostiz({ posts: [post({ id: "export_pin" })], integrationIds: channels, date: future() });
    expect(summary.preflight.blockedChannels.map((channel) => channel.integrationId)).toEqual(["pin"]);
    expect(summary.exported).toEqual(["export_pin"]);
  });

  it("never sends the same content twice", async () => {
    const before = counts.creates;
    const summary = await exportPostsToPostiz({ posts: [post()], integrationIds: channels, date: future() });
    expect(summary.skipped).toEqual(["export_1"]);
    expect(counts.creates).toBe(before);
  });

  it("re-exports once a reviewer edits the caption, reusing the uploaded graphic", async () => {
    const uploadsBefore = counts.uploads;
    const summary = await exportPostsToPostiz({ posts: [post({ caption: "Rewritten after review." })], integrationIds: channels, date: future() });
    expect(summary.exported).toEqual(["export_1"]);
    expect(counts.uploads).toBe(uploadsBefore);
  });

  it("looks up channels once per batch rather than once per post", async () => {
    const before = counts.integrations;
    await exportPostsToPostiz({
      posts: [post({ id: "batch_a", caption: "A" }), post({ id: "batch_b", caption: "B" })],
      integrationIds: ["fb"],
      date: future()
    });
    expect(counts.integrations - before).toBe(1);
  });

  it("stops the batch on a rate limit and reports the wait, without hanging on Retry-After", async () => {
    failNextCreate = 429;
    const summary = await exportPostsToPostiz({
      posts: [post({ id: "limited_a", caption: "One" }), post({ id: "limited_b", caption: "Two" })],
      integrationIds: ["fb"],
      date: future()
    });
    expect(summary.failed).toEqual(["limited_a", "limited_b"]);
    expect(summary.outcomes[0].reason).toContain("30 minutes");
    expect(summary.outcomes[1].retryable).toBe(true);
  });

  it("surfaces a rejected payload without retrying it", async () => {
    failNextCreate = 400;
    const summary = await exportPostsToPostiz({ posts: [post({ id: "bad", caption: "Bad" })], integrationIds: ["fb"], date: future() });
    expect(summary.failed).toEqual(["bad"]);
    expect(summary.outcomes[0].retryable).toBe(false);
    expect(counts.creates).toBeGreaterThan(0);
  });
});
