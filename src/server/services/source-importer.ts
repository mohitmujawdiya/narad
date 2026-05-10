import { db } from "../db";
import { logActivity } from "./activity-log";
import { detectFormat, getParser, type ParsedTarget, type SourceFormat } from "./parsers";
import { researchPursuit } from "./research-engine";
import { generateJdEvaluation } from "./jd-artifacts";

export type ImportResult = {
  format: SourceFormat;
  parsed: number;
  inserted: number;
  pursuitIds: string[];
  errors: string[];
};

export async function parseAndImport(raw: string): Promise<ImportResult> {
  const detection = detectFormat(raw);
  const parser = getParser(detection.format);

  let parsed: ParsedTarget[];
  try {
    parsed = await parser.parse(detection.raw);
  } catch (err) {
    return {
      format: detection.format,
      parsed: 0,
      inserted: 0,
      pursuitIds: [],
      errors: [(err as Error).message ?? "Parse error"],
    };
  }

  const pursuitIds: string[] = [];
  const errors: string[] = [];

  for (const target of parsed) {
    try {
      const pursuit = await db.pursuit.create({
        data: {
          type: target.type,
          companyName: target.companyName,
          companyDomain: target.companyDomain,
          jdUrl: target.jdUrl,
          pastedUrl: target.pastedUrl,
          notes: target.hint,
        },
      });
      pursuitIds.push(pursuit.id);
      await logActivity({
        type: "pursuit-created",
        pursuitId: pursuit.id,
        payload: { type: target.type, source: detection.format },
      });
      // Background: research + (for jobs) JD evaluation. Fire and forget.
      void researchPursuit(pursuit.id).catch(() => {});
      if (target.type === "job") {
        void generateJdEvaluation(pursuit.id).catch(() => {});
      }
    } catch (err) {
      errors.push(`${target.companyName}: ${(err as Error).message ?? "DB error"}`);
    }
  }

  return {
    format: detection.format,
    parsed: parsed.length,
    inserted: pursuitIds.length,
    pursuitIds,
    errors,
  };
}
