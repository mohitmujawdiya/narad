import { createHash } from "node:crypto";
import { db } from "../db";
import { perplexityResearch } from "./ai/perplexity";
import {
  companyOverviewPrompt,
  hiringSignalPrompt,
  founderContentPrompt,
  type CompanyContext,
} from "./ai/prompts/company-research";
import { logActivity } from "./activity-log";
import type { ResearchResult } from "./ai/types";

const CACHE_TTL_DAYS = 14;
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

type ResearchKind = "overview" | "hiringSignal" | "founderContent";

const PROMPT_BUILDERS: Record<ResearchKind, (c: CompanyContext) => string> = {
  overview: companyOverviewPrompt,
  hiringSignal: hiringSignalPrompt,
  founderContent: founderContentPrompt,
};

/**
 * Run all 3 research queries for a company (cached) and persist the latest
 * snapshot to CompanyResearch. Transitions company.status to Researched.
 * Idempotent: callable repeatedly without re-querying within TTL.
 */
export async function researchCompany(companyId: string): Promise<void> {
  await runResearch(companyId, { useCache: true });
}

/**
 * Force re-fetch (ignore cache). Used by the manual refresh button.
 */
export async function refreshCompanyResearch(companyId: string): Promise<void> {
  await runResearch(companyId, { useCache: false });
}

async function runResearch(companyId: string, opts: { useCache: boolean }): Promise<void> {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const ctx: CompanyContext = { name: company.name, domain: company.domain };

  const kinds: ResearchKind[] = ["overview", "hiringSignal", "founderContent"];

  const results = await Promise.all(
    kinds.map(async (kind) => {
      const prompt = PROMPT_BUILDERS[kind](ctx);
      const queryHash = hashQuery({ companyId, kind, prompt });

      if (opts.useCache) {
        const cached = await db.researchCache.findUnique({ where: { queryHash } });
        if (cached && cached.expiresAt > new Date()) {
          return { kind, result: cached.result as unknown as ResearchResult };
        }
      }

      const result = await perplexityResearch({ prompt });

      await db.researchCache.upsert({
        where: { queryHash },
        update: {
          result: serializeResult(result),
          citations: result.citations as unknown as object,
          expiresAt: new Date(Date.now() + CACHE_TTL_MS),
        },
        create: {
          queryHash,
          source: "perplexity-sonar",
          query: prompt,
          result: serializeResult(result),
          citations: result.citations as unknown as object,
          expiresAt: new Date(Date.now() + CACHE_TTL_MS),
        },
      });

      return { kind, result };
    }),
  );

  const byKind = results.reduce<Record<string, ResearchResult>>((acc, r) => {
    acc[r.kind] = r.result;
    return acc;
  }, {});

  await db.companyResearch.upsert({
    where: { companyId },
    update: {
      overview: serializeResult(byKind.overview),
      hiringSignal: serializeResult(byKind.hiringSignal),
      founderContent: serializeResult(byKind.founderContent),
      refreshedAt: new Date(),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
    create: {
      companyId,
      overview: serializeResult(byKind.overview),
      hiringSignal: serializeResult(byKind.hiringSignal),
      founderContent: serializeResult(byKind.founderContent),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
  });

  await db.company.update({
    where: { id: companyId },
    data: company.status === "Discovered" ? { status: "Researched" } : {},
  });

  await logActivity({
    type: "research-cached",
    companyId,
    payload: { fromCache: !opts.useCache ? false : "mixed", kinds },
  });
}

function hashQuery(input: { companyId: string; kind: string; prompt: string }): string {
  return createHash("sha256")
    .update(`${input.companyId}|${input.kind}|${input.prompt}`)
    .digest("hex");
}

function serializeResult(r: ResearchResult): object {
  return {
    text: r.text,
    citations: r.citations,
    meta: r.meta,
  };
}
