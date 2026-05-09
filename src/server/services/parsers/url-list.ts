import type { SourceParser, ParsedTarget } from "./types";

const URL_LINE = /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i;

export const urlListParser: SourceParser = {
  format: "url-list",
  matches(input: string): boolean {
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) return false;
    return lines.every((l) => URL_LINE.test(l));
  },
  async parse(input: string): Promise<ParsedTarget[]> {
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    return lines.map((line) => parseLineToTarget(line));
  },
};

export function parseLineToTarget(line: string): ParsedTarget {
  const url = line.startsWith("http") ? line : `https://${line}`;
  let domain: string;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = line;
  }
  const name = domain
    .split(".")[0]
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  return {
    name,
    domain,
    sourceUrl: url,
    sector: null,
    stage: null,
    hint: null,
  };
}
