import { db } from "../db";
import { detectFormat, getParser } from "./parsers/format-detector";
import type { ParsedTarget, ParseResult } from "./parsers/types";
import { logActivity } from "./activity-log";
import { scoreCompanyFit } from "./research-engine";

export type ImportResult = {
  format: ParseResult["format"];
  parsed: number;
  inserted: number;
  duplicates: number;
  companyIds: string[];
};

/**
 * Detect format → parse → dedupe by domain → insert as Discovered.
 * Fit-scores each new company in the background (non-blocking).
 */
export async function parseAndImport(input: string): Promise<ImportResult> {
  const format = detectFormat(input);
  if (!format) {
    return { format: null, parsed: 0, inserted: 0, duplicates: 0, companyIds: [] };
  }

  const parser = getParser(format);
  const targets = await parser.parse(input);

  const inserted: string[] = [];
  let duplicates = 0;

  for (const target of targets) {
    const existing = target.domain
      ? await db.company.findUnique({ where: { domain: target.domain } })
      : null;

    if (existing) {
      duplicates++;
      continue;
    }

    const company = await insertTarget(target);
    inserted.push(company.id);
    void scoreCompanyFit(company.id);
  }

  await logActivity({
    type: "company-created",
    payload: { via: "bulk-import", format, parsed: targets.length, inserted: inserted.length, duplicates },
  });

  return {
    format,
    parsed: targets.length,
    inserted: inserted.length,
    duplicates,
    companyIds: inserted,
  };
}

async function insertTarget(t: ParsedTarget) {
  return db.company.create({
    data: {
      name: t.name,
      domain: t.domain,
      sourceUrl: t.sourceUrl,
      sector: t.sector,
      stage: t.stage,
      notes: t.hint ? `Source hint: ${t.hint}` : null,
    },
  });
}
