import { createHash } from "node:crypto";
import { db } from "../db";
import { webResearch } from "./ai/web-research";
import {
  companyOverviewPrompt,
  hiringSignalPrompt,
  founderContentPrompt,
  type CompanyContext,
} from "./ai/prompts/company-research";
import { logActivity } from "./activity-log";
import type { ResearchResult, FitScore } from "./ai/types";
import { openaiJson } from "./ai/openai-chat";
import { fitScoreSystemPrompt, fitScoreUserPrompt } from "./ai/prompts/fit-score";

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

      const result = await webResearch({ prompt });

      await db.researchCache.upsert({
        where: { queryHash },
        update: {
          result: serializeResult(result),
          citations: result.citations as unknown as object,
          expiresAt: new Date(Date.now() + CACHE_TTL_MS),
        },
        create: {
          queryHash,
          source: "openai-web-search",
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

  // Hydrate the Company row from the research output: extract headcount,
  // stage, sector if not already set, then re-score fit using the richer
  // research context. Both are best-effort; failures don't block research.
  await extractCompanyFactsFromOverview(companyId, byKind.overview?.text ?? "").catch((e) => {
    console.warn("extractCompanyFactsFromOverview skipped:", (e as Error).message);
  });
  await scoreCompanyFit(companyId).catch((e) => {
    console.warn("post-research fit score skipped:", (e as Error).message);
  });
}

/**
 * Extract structured fields (headcount, stage, sector) from a free-form overview
 * and update the Company row. Only fills fields that are currently null —
 * preserves any user-set values.
 */
export async function extractCompanyFactsFromOverview(
  companyId: string,
  overviewText: string,
): Promise<void> {
  if (!overviewText.trim()) return;

  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });

  const result = await openaiJson<{
    headcount: number | null;
    stage: string | null;
    sector: string | null;
  }>({
    system:
      'Extract structured company facts from a research overview. Return JSON only: {"headcount": <integer or null>, "stage": <string or null>, "sector": <string or null>}. headcount is the best estimate as an integer (e.g., 250 for "200-300 employees"). stage is one of: "pre-seed", "seed", "series-a", "series-b", "series-c", "series-d+", "growth", "public", "private". sector is a short descriptor (e.g., "fintech", "AI infra", "developer tools", "VC firm"). Use null if a fact is not present. Do not invent.',
    user: `Overview text:\n\n${overviewText.slice(0, 4000)}`,
    model: "gpt-5.4-mini",
    maxTokens: 200,
  });

  // Only update fields that are currently empty — don't overwrite user-set values.
  await db.company.update({
    where: { id: companyId },
    data: {
      headcount: company.headcount ?? result.data.headcount ?? undefined,
      stage: company.stage ?? result.data.stage ?? undefined,
      sector: company.sector ?? result.data.sector ?? undefined,
    },
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

/**
 * Quick fit score (Sonnet, fast). Called on Company creation if we have a Profile
 * with narrative or CV. Failures are logged but non-blocking — the Company
 * still gets created.
 */
export async function scoreCompanyFit(companyId: string): Promise<FitScore | null> {
  const profile = await db.profile.findUnique({ where: { id: "singleton" } });
  if (!profile?.narrative && !profile?.cvMarkdown) return null;

  try {
    const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });

    const result = await openaiJson<{ score: number; reason: string }>({
      system: fitScoreSystemPrompt(),
      user: fitScoreUserPrompt({
        profile: {
          narrative: profile.narrative,
          archetypes: profile.archetypes,
          cvMarkdown: profile.cvMarkdown,
        },
        company: {
          name: company.name,
          domain: company.domain,
          sector: company.sector,
          stage: company.stage,
        },
      }),
      model: "gpt-5.4-mini",
      maxTokens: 200,
    });

    const score = clamp(Math.round(result.data.score), 0, 100);
    const reason = String(result.data.reason ?? "").slice(0, 200);

    await db.company.update({
      where: { id: companyId },
      data: { fitScore: score, fitReason: reason },
    });

    return { score, reason, meta: result.meta };
  } catch (e) {
    console.warn("fit-score skipped:", (e as Error).message);
    return null;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
