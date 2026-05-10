import type { ParsedTarget, Parser } from "./types";

/**
 * Strip leading "www." and produce a capitalized name from the apex word.
 * acme.com -> Acme · foo-bar.io -> Foo-bar
 */
export function deriveNameFromHost(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    host = url;
  }
  host = host.replace(/^www\./i, "");
  const apex = host.split(".")[0] ?? host;
  if (!apex) return host;
  return apex.charAt(0).toUpperCase() + apex.slice(1);
}

export function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

export const urlListParser: Parser = {
  format: "url-list",
  parse(raw: string): ParsedTarget[] {
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const out: ParsedTarget[] = [];
    for (const url of lines) {
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({
        type: "company",
        companyName: deriveNameFromHost(url),
        companyDomain: getHostname(url),
        jdUrl: null,
        pastedUrl: url,
        hint: null,
      });
    }
    return out;
  },
};
