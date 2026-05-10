import type { ParsedTarget, Parser } from "./types";
import { extractJd } from "../jd-extractor";

export const jdParser: Parser = {
  format: "jd-url",
  async parse(raw: string): Promise<ParsedTarget[]> {
    const url = raw.trim();
    const extracted = await extractJd(url);
    if (!extracted) return [];
    return [
      {
        type: "job",
        companyName: extracted.companyName,
        companyDomain: extracted.companyDomain,
        jdUrl: url,
        pastedUrl: url,
        hint: extracted.title,
      },
    ];
  },
};
