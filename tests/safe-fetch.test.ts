import { describe, expect, it } from "vitest";
import { addressIsPrivate, assertPublicUrl, BlockedUrlError } from "@/src/lib/safe-fetch";

/**
 * Guards the request-forgery fix. POST /api/posts accepts a whole article and
 * the server fetches its externalUrl and featuredImageUrl, so these URLs are
 * attacker-controlled input.
 */
describe("private address detection", () => {
  it.each([
    "127.0.0.1", "127.1.2.3", "10.0.0.5", "192.168.1.10", "172.16.0.5", "172.31.255.255",
    "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1", "::1", "::",
    "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"
  ])("treats %s as private", (address) => {
    expect(addressIsPrivate(address)).toBe(true);
  });

  it.each(["93.184.216.34", "1.1.1.1", "8.8.8.8", "2606:2800:220:1:248:1893:25c8:1946"])("treats %s as public", (address) => {
    expect(addressIsPrivate(address)).toBe(false);
  });

  it("treats anything unparseable as private rather than guessing", () => {
    expect(addressIsPrivate("not-an-address")).toBe(true);
  });
});

describe("url guard", () => {
  it("allows an ordinary public https url", async () => {
    await expect(assertPublicUrl("https://example.com/article")).resolves.toBeInstanceOf(URL);
  });

  it.each([
    ["loopback by name", "http://localhost:5000/x"],
    ["loopback by address", "http://127.0.0.1:5000/x"],
    ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
    ["rfc1918", "http://10.0.0.5/admin"],
    ["rfc1918 again", "http://192.168.1.1/"],
    ["ipv4-mapped ipv6", "http://[::ffff:127.0.0.1]/"],
    ["ipv6 loopback", "http://[::1]:8080/"]
  ])("blocks %s", async (_label, url) => {
    await expect(assertPublicUrl(url)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it.each([
    ["file", "file:///etc/passwd"],
    ["gopher", "gopher://example.com/"],
    ["data", "data:text/plain,hello"]
  ])("blocks the %s protocol", async (_label, url) => {
    await expect(assertPublicUrl(url)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("blocks a decimal-encoded loopback address", async () => {
    // http://2130706433/ is another way to write 127.0.0.1.
    await expect(assertPublicUrl("http://2130706433/")).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("blocks a hostname that resolves to a private address", async () => {
    // localtest.me and friends resolve to 127.0.0.1, which a hostname
    // blocklist would happily wave through.
    await expect(assertPublicUrl("http://localtest.me/")).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("permits loopback only when the caller opts in", async () => {
    await expect(assertPublicUrl("http://localhost:5000/x", { allowLoopback: true })).resolves.toBeInstanceOf(URL);
    // Opting in to loopback must not open up the rest of the private space.
    await expect(assertPublicUrl("http://169.254.169.254/", { allowLoopback: true })).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(assertPublicUrl("http://10.0.0.5/", { allowLoopback: true })).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("rejects a malformed url", async () => {
    await expect(assertPublicUrl("http://")).rejects.toBeInstanceOf(BlockedUrlError);
  });
});
