import { describe, expect, it } from "vitest";
import { isValidHandoffUrl } from "@/src/config/handoff-settings";

describe("handoff public URL validation", () => {
  it.each([
    "https://localhost:3000",
    "https://127.0.0.1:3000",
    "https://127.5.5.5",
    "https://0.0.0.0:3000",
    "https://[::1]:3000"
  ])("rejects localhost address %s", (url) => {
    expect(isValidHandoffUrl(url, "public")).toBe(false);
  });

  it("accepts a real public domain", () => {
    expect(isValidHandoffUrl("https://sck-tool.example.com", "public")).toBe(true);
  });
});
