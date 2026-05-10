import type { ParsedTarget, Parser } from "./types";
import { deriveNameFromHost, getHostname } from "./url-list";

export const singleUrlParser: Parser = {
  format: "single-url",
  parse(raw: string): ParsedTarget[] {
    const url = raw.trim();
    if (!url) return [];
    return [
      {
        type: "company",
        companyName: deriveNameFromHost(url),
        companyDomain: getHostname(url),
        jdUrl: null,
        pastedUrl: url,
        hint: null,
      },
    ];
  },
};
