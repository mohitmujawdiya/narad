import type { SourceParser, ParsedTarget } from "./types";
import { webResearch } from "../ai/web-research";

const YC_PATTERN = /(?:^|\/\/)(?:www\.)?ycombinator\.com\/companies\b/i;

export const ycParser: SourceParser = {
  format: "yc-batch",
  matches(input: string): boolean {
    return YC_PATTERN.test(input.trim());
  },
  async parse(input: string): Promise<ParsedTarget[]> {
    const url = input.trim();
    const batch = extractBatch(url);

    const prompt = `Visit ${url} and list ALL companies on that page. For each company, return: name, domain (without https://), sector, and stage (which YC batch — e.g., "S25"). Return ONLY a JSON object with shape:
{"companies": [{"name": "...", "domain": "...", "sector": "...", "stage": "..."}, ...]}
No prose, no fences. If you can't find any, return {"companies": []}.`;

    const result = await webResearch({
      prompt,
      system: "You return JSON only when asked. No fences, no prose.",
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
          hint: batch ? `YC ${batch}` : "YC",
        }));
    } catch {
      return [];
    }
  },
};

function extractBatch(url: string): string | null {
  const m = url.match(/[?&]batch=([A-Za-z0-9]+)/);
  return m ? m[1].toUpperCase() : null;
}
