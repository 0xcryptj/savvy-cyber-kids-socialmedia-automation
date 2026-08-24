import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { getPostizSettings, savePostizSettings } from "@/src/config/postiz-settings";

/**
 * The bug these cover: savePostizSettings used to write back the *resolved*
 * apiUrl, so merely testing the connection pinned it to disk and silently
 * shadowed POSTIZ_API_URL from then on - with nothing in the UI to show it.
 */
let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "postiz-settings-"));
  process.env.POSTIZ_SETTINGS_PATH = path.join(directory, "settings.json");
  delete process.env.POSTIZ_API_URL;
  delete process.env.POSTIZ_API_KEY;
});

afterEach(async () => {
  delete process.env.POSTIZ_SETTINGS_PATH;
  delete process.env.POSTIZ_API_URL;
  delete process.env.POSTIZ_API_KEY;
  await rm(directory, { recursive: true, force: true });
});

const stored = async () => JSON.parse(await readFile(process.env.POSTIZ_SETTINGS_PATH!, "utf8"));

describe("postiz settings resolution", () => {
  it("falls back to the cloud default when nothing is set", async () => {
    const settings = await getPostizSettings();
    expect(settings.apiUrl).toBe("https://api.postiz.com/public/v1");
    expect(settings.apiUrlSource).toBe("default");
    expect(settings.apiKeySource).toBe("none");
  });

  it("uses the environment when no override is saved", async () => {
    process.env.POSTIZ_API_URL = "https://postiz.example.com/public/v1";
    process.env.POSTIZ_API_KEY = "env-key";
    const settings = await getPostizSettings();
    expect(settings.apiUrl).toBe("https://postiz.example.com/public/v1");
    expect(settings.apiUrlSource).toBe("environment");
    expect(settings.apiKey).toBe("env-key");
    expect(settings.apiKeySource).toBe("environment");
  });

  it("rejects a non-loopback http url rather than downgrading the connection", async () => {
    process.env.POSTIZ_API_URL = "http://postiz.example.com/public/v1";
    expect((await getPostizSettings()).apiUrl).toBe("https://api.postiz.com/public/v1");
  });

  it.each([
    "http://localhost:5000/public/v1",
    "http://127.0.0.1:5000/public/v1",
    "http://127.1.2.3:5000/public/v1",
    "http://[::1]:5000/public/v1"
  ])("allows http on loopback for a local self-hosted Postiz: %s", async (url) => {
    process.env.POSTIZ_API_URL = url;
    expect((await getPostizSettings()).apiUrl).toBe(url);
  });
});

describe("saving postiz settings", () => {
  it("does not pin the api url when only recording a connection test", async () => {
    process.env.POSTIZ_API_URL = "https://postiz.example.com/public/v1";
    await savePostizSettings({ lastTest: { status: "success", testedAt: "2026-01-01T00:00:00.000Z", channelCount: 1 } });

    expect(await stored()).not.toHaveProperty("apiUrl");
    const settings = await getPostizSettings();
    expect(settings.apiUrlSource).toBe("environment");
    expect(settings.lastTest?.channelCount).toBe(1);
  });

  it("keeps following the environment after the url there changes", async () => {
    process.env.POSTIZ_API_URL = "https://first.example.com/public/v1";
    await savePostizSettings({ lastTest: { status: "success", testedAt: "2026-01-01T00:00:00.000Z" } });
    process.env.POSTIZ_API_URL = "https://second.example.com/public/v1";
    expect((await getPostizSettings()).apiUrl).toBe("https://second.example.com/public/v1");
  });

  it("saves a url the operator actually entered, and reports it as saved", async () => {
    process.env.POSTIZ_API_URL = "https://env.example.com/public/v1";
    await savePostizSettings({ apiUrl: "https://chosen.example.com/public/v1" });
    expect((await stored()).apiUrl).toBe("https://chosen.example.com/public/v1");
    const settings = await getPostizSettings();
    expect(settings.apiUrl).toBe("https://chosen.example.com/public/v1");
    expect(settings.apiUrlSource).toBe("saved");
  });

  it("clears a saved override back to the environment", async () => {
    process.env.POSTIZ_API_URL = "https://env.example.com/public/v1";
    await savePostizSettings({ apiUrl: "https://chosen.example.com/public/v1" });
    await savePostizSettings({ apiUrl: "" });
    expect(await stored()).not.toHaveProperty("apiUrl");
    expect((await getPostizSettings()).apiUrlSource).toBe("environment");
  });

  it("keeps a saved override across an unrelated save", async () => {
    await savePostizSettings({ apiUrl: "https://chosen.example.com/public/v1" });
    await savePostizSettings({ lastTest: { status: "failed", testedAt: "2026-01-02T00:00:00.000Z", reason: "down" } });
    const settings = await getPostizSettings();
    expect(settings.apiUrl).toBe("https://chosen.example.com/public/v1");
    expect(settings.lastTest?.reason).toBe("down");
  });

  it("ignores a malformed url instead of storing it", async () => {
    await savePostizSettings({ apiUrl: "not a url" });
    expect(await stored()).not.toHaveProperty("apiUrl");
  });
});
