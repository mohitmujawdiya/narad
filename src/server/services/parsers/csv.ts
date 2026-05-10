import type { ParsedTarget, Parser } from "./types";

const NAME_KEYS = ["companyname", "name"];
const DOMAIN_KEYS = ["companydomain", "domain", "website"];
const JD_URL_KEYS = ["jdurl", "url", "joburl"];
const HINT_KEYS = ["hint"];

/**
 * Minimal CSV row splitter — handles double-quoted fields with embedded commas
 * and escaped double-quotes (""). Newlines inside quoted fields are not
 * supported (parser splits on \n at the line level).
 */
function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function pick(
  row: Record<string, string>,
  keys: string[],
): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== "") return v;
  }
  return null;
}

export const csvParser: Parser = {
  format: "csv",
  parse(raw: string): ParsedTarget[] {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];

    const header = splitCsvRow(lines[0]!).map((h) => h.toLowerCase());
    const out: ParsedTarget[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = splitCsvRow(lines[i]!);
      const row: Record<string, string> = {};
      for (let j = 0; j < header.length; j++) {
        row[header[j]!] = cells[j] ?? "";
      }

      const companyName = pick(row, NAME_KEYS);
      if (!companyName) continue;

      const companyDomain = pick(row, DOMAIN_KEYS);
      const jdUrl = pick(row, JD_URL_KEYS);
      const hint = pick(row, HINT_KEYS);

      out.push({
        type: jdUrl ? "job" : "company",
        companyName,
        companyDomain,
        jdUrl,
        pastedUrl: jdUrl ?? null,
        hint,
      });
    }
    return out;
  },
};
