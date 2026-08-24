import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Outbound fetch for URLs this app did not choose.
 *
 * Feed items, article images and anything a caller hands us are attacker-
 * influenceable: POST /api/posts accepts a whole article, and its externalUrl
 * and featuredImageUrl are fetched server-side. Without a guard that is a
 * request forgery primitive pointed at whatever the server can reach - cloud
 * metadata, internal admin services, other tenants.
 *
 * Checking the hostname string is not enough. A name can resolve to a private
 * address, an address can be spelled in decimal or as IPv4-mapped IPv6, and a
 * permitted public host can redirect onto an internal one. So every hop is
 * resolved to its actual addresses and each address is checked.
 */
export class BlockedUrlError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "BlockedUrlError";
  }
}

function ipv4IsPrivate(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||                                  // "this network"
    a === 10 ||                                 // RFC1918
    a === 127 ||                                // loopback
    (a === 100 && b >= 64 && b <= 127) ||       // RFC6598 carrier-grade NAT
    (a === 169 && b === 254) ||                 // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||        // RFC1918
    (a === 192 && b === 168) ||                 // RFC1918
    (a === 192 && b === 0) ||                   // IETF protocol assignments
    (a === 198 && (b === 18 || b === 19)) ||    // benchmarking
    a >= 224                                    // multicast, reserved, broadcast
  );
}

function ipv6IsPrivate(address: string): boolean {
  const host = address.toLowerCase().replace(/^\[|\]$/g, "");

  // ::ffff:127.0.0.1 carries an IPv4 address inside an IPv6 one, and the URL
  // parser rewrites it to its hex form (::ffff:7f00:1), so both spellings have
  // to be unwrapped back to the IPv4 address they actually mean.
  const dotted = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return ipv4IsPrivate(dotted[1]);
  const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const high = parseInt(hex[1], 16);
    const low = parseInt(hex[2], 16);
    return ipv4IsPrivate(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }
  return (
    host === "::" ||
    host === "::1" ||                           // loopback
    host.startsWith("fc") || host.startsWith("fd") ||  // unique local
    host.startsWith("fe80") ||                  // link-local
    host.startsWith("ff")                       // multicast
  );
}

export function addressIsPrivate(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return ipv4IsPrivate(address);
  if (version === 6) return ipv6IsPrivate(address);
  return true;
}

/** Allows loopback, for a self-hosted service the operator deliberately configured. */
export type UrlGuardOptions = { allowLoopback?: boolean };

export async function assertPublicUrl(raw: string | URL, options: UrlGuardOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = raw instanceof URL ? raw : new URL(String(raw));
  } catch {
    throw new BlockedUrlError("Not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError(`Unsupported protocol: ${url.protocol}`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const loopbackName = host.toLowerCase() === "localhost";

  // Resolve the name so an innocuous-looking host cannot point somewhere internal.
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true })).map((entry) => entry.address);
    } catch {
      throw new BlockedUrlError(`Could not resolve ${url.hostname}`);
    }
  }
  if (!addresses.length) throw new BlockedUrlError(`Could not resolve ${url.hostname}`);

  for (const address of addresses) {
    if (!addressIsPrivate(address)) continue;
    const loopback = address === "::1" || address.startsWith("127.") || loopbackName;
    if (options.allowLoopback && loopback) continue;
    throw new BlockedUrlError(`${url.hostname} resolves to a non-public address (${address})`);
  }
  return url;
}

const maxRedirects = 3;

/**
 * Follows redirects by hand so every hop is checked. `redirect: "follow"` would
 * validate only the first URL and then go wherever it is sent.
 */
export async function safeFetch(raw: string | URL, init: RequestInit = {}, options: UrlGuardOptions = {}): Promise<Response> {
  let target = await assertPublicUrl(raw, options);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const response = await fetch(target, { ...init, redirect: "manual" });
    if (response.status < 300 || response.status > 399) return response;

    const location = response.headers.get("location");
    if (!location) return response;
    target = await assertPublicUrl(new URL(location, target), options);
  }
  throw new BlockedUrlError(`Too many redirects (more than ${maxRedirects})`);
}
