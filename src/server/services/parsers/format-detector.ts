import type { SourceParser, ParserFormat } from "./types";
import { ycParser } from "./yc";
import { wellfoundParser } from "./wellfound";
import { csvParser } from "./csv";
import { urlListParser } from "./url-list";
import { singleUrlParser } from "./single-url";

// Order matters — most-specific first.
const PARSERS: SourceParser[] = [ycParser, wellfoundParser, csvParser, urlListParser, singleUrlParser];

export function detectFormat(input: string): ParserFormat | null {
  for (const p of PARSERS) {
    if (p.matches(input)) return p.format;
  }
  return null;
}

export function getParser(format: ParserFormat): SourceParser {
  const p = PARSERS.find((x) => x.format === format);
  if (!p) throw new Error(`No parser for format: ${format}`);
  return p;
}
