import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { getAISettings, providerCredentialStatus, providerHasCredential, saveAISettings } from "@/src/config/ai-settings";
import { getStoredCredential, saveStoredCredential } from "@/src/config/credentials";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "ai-settings-"));
  process.env.STORAGE_DIR = directory;
  process.env.SCK_CREDENTIALS_ENCRYPTION_KEY = "x".repeat(32);
  delete process.env.AI_PROVIDER;
  delete process.env.AI_MODEL;
  delete process.env.AI_API_KEY;
  delete process.env.AI_BASE_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(async () => {
  delete process.env.STORAGE_DIR;
  delete process.env.SCK_CREDENTIALS_ENCRYPTION_KEY;
  await rm(directory, { recursive: true, force: true });
});

describe("AI settings", () => {
  it("saves the selected provider and encrypted key globally", async () => {
    await saveAISettings({ provider: "anthropic", model: "claude-sonnet-5", anthropicWorkspaceId: "wrkspc_test123" });
    await saveStoredCredential("anthropic", "sk-ant-test");

    expect(await getAISettings()).toMatchObject({ provider: "anthropic", model: "claude-sonnet-5", anthropicWorkspaceId: "wrkspc_test123" });
    expect(await getStoredCredential("anthropic")).toBe("sk-ant-test");
    expect(await providerHasCredential("anthropic")).toBe(true);
    expect(await providerCredentialStatus()).toMatchObject({ anthropic: true, openai: false });

    const raw = await readFile(path.join(directory, "credentials.json"), "utf8");
    expect(raw).not.toContain("sk-ant-test");
  });

  it("uses a current Claude model when Anthropic is configured from the environment", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-env";
    process.env.AI_PROVIDER = "anthropic";
    await saveAISettings({ provider: "anthropic" });

    expect((await getAISettings()).model).toBe("claude-sonnet-5");
    expect(await providerHasCredential("anthropic")).toBe(true);
  });

  it("replaces stale preset-provider models instead of saving a placeholder", async () => {
    await saveAISettings({ provider: "anthropic", model: "claude-3-5-sonnet-latest" });
    expect((await getAISettings()).model).toBe("claude-sonnet-5");

    await saveAISettings({ provider: "anthropic", model: "__custom" });
    expect((await getAISettings()).model).toBe("claude-sonnet-5");
  });

  it("sanitizes the optional Anthropic workspace id", async () => {
    await saveAISettings({ provider: "anthropic", anthropicWorkspaceId: "bad value!" });
    expect((await getAISettings()).anthropicWorkspaceId).toBe("");

    await saveAISettings({ provider: "anthropic", anthropicWorkspaceId: "workspace_abc-123" });
    expect((await getAISettings()).anthropicWorkspaceId).toBe("workspace_abc-123");
  });
});
