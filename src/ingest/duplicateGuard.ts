export function isDuplicate(canonicalUrl: string, knownCanonicalUrls: Set<string>): boolean { return knownCanonicalUrls.has(canonicalUrl); }
