export * from "./types";
export { detectFormat } from "./format-detector";
import type { Parser, SourceFormat } from "./types";
import { csvParser } from "./csv";
import { urlListParser } from "./url-list";
import { singleUrlParser } from "./single-url";
import { jdParser } from "./jd";
import { ycParser } from "./yc";
import { wellfoundParser } from "./wellfound";

const PARSERS: Record<SourceFormat, Parser> = {
  csv: csvParser,
  "url-list": urlListParser,
  "single-url": singleUrlParser,
  "jd-url": jdParser,
  "yc-batch": ycParser,
  "wellfound-search": wellfoundParser,
};

export function getParser(format: SourceFormat): Parser {
  return PARSERS[format];
}
