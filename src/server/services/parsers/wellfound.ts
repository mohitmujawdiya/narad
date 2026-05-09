import type { SourceParser, ParsedTarget } from "./types";
import { webResearch } from "../ai/web-research";

const WELLFOUND_PATTERN = /(?:^|\/\/)(?:www\.)?wellfound\.com\b/i;

export const wellfoundParser: SourceParser = {
  format: "wellfound",
  matches(input: string): boolean {
    return WELLFOUND_PATTERN.test(input.trim());
  },
  async parse(input: string): Promise<ParsedTarget[]> {
    const url = input.trim();
    const prompt = `Visit ${url} and list every company on that page. For each, return: name, domain (without https://), sector, and stage. Return ONLY:
{"companies": [{"name": "...", "domain": "...", "sector": "...", "stage": "..."}, ...]}
No prose, no fences.`;

    const result = await webResearch({
      prompt,
      system: "You return JSON only. No fences, no prose.",
    });
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    try {
      const data = JSON.parse(cleaned) as { companies?: { name?: string; domain?: string; sector?: string; stage?: string }[] };
      const list = Array.isArray(data.companies) ? data.companies : [];
      return list
        .filter((c) => c.name)
        .map((c) => ({
          name: c.name!,
          domain: c.domain || null,
          sourceUrl: url,
          sector: c.sector || null,
          stage: c.stage || null,
          hint: "Wellfound",
        }));
    } catch {
      return [];
    }
  },
};
