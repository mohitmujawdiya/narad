import type { SourceParser, ParsedTarget } from "./types";
import { parseLineToTarget } from "./url-list";

const URL_LINE = /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i;

export const singleUrlParser: SourceParser = {
  format: "single-url",
  matches(input: string): boolean {
    const trimmed = input.trim();
    if (trimmed.includes("\n")) return false;
    return URL_LINE.test(trimmed);
  },
  async parse(input: string): Promise<ParsedTarget[]> {
    return [parseLineToTarget(input.trim())];
  },
};
