import type { SourceParser, ParsedTarget } from "./types";

export const csvParser: SourceParser = {
  format: "csv",
  matches(input: string): boolean {
    const firstLine = input.split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
    if (!firstLine.includes(",")) return false;
    const headers = firstLine.split(",").map((s) => s.trim());
    return headers.some((h) => h === "name" || h === "domain" || h === "company");
  },
  async parse(input: string): Promise<ParsedTarget[]> {
    const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = (key: string) => headers.findIndex((h) => h === key);

    const nameIdx = idx("name") !== -1 ? idx("name") : idx("company");
    const domainIdx = idx("domain");
    const sectorIdx = idx("sector");
    const stageIdx = idx("stage");
    const sourceIdx = idx("source") !== -1 ? idx("source") : idx("url");

    const out: ParsedTarget[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const name = nameIdx !== -1 ? cols[nameIdx] : cols[0];
      if (!name) continue;
      out.push({
        name,
        domain: domainIdx !== -1 ? cols[domainIdx] || null : null,
        sourceUrl: sourceIdx !== -1 ? cols[sourceIdx] || null : null,
        sector: sectorIdx !== -1 ? cols[sectorIdx] || null : null,
        stage: stageIdx !== -1 ? cols[stageIdx] || null : null,
        hint: null,
      });
    }
    return out;
  },
};
