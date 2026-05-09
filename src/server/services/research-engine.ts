/**
 * Research engine — Pursuit-shaped (redesign-v2 Slice 2).
 *
 * Runs three OpenAI Responses + web_search queries in parallel per Pursuit:
 *   - companyOverviewPrompt
 *   - hiringSignalPrompt
 *   - founderContentPrompt
 * Each result is cached in `ResearchCache` keyed by SHA-256(pursuitId+kind+prompt)
 * with a 30d TTL. Results are packed into `Pursuit.companyResearch` (JSON), then
 * `extractCompanyFactsFromOverview` and `scoreCompanyFit` are called to populate
 * `companyDomain`, the `facts` block, `fitScore`, and `fitReason`.
 */
import { createHash } from "node:crypto";
import { db } from "../db";
import { logActivity } from "./activity-log";
import {
  decodePursuit,
  type CompanyResearchJson,
  type CompanyResearchFacts,
  type ResearchEntry,
} from "../types/pursuit";
import { webResearch } from "./ai/web-research";
import { openaiJson } from "./ai/openai-chat";
import {
  companyOverviewPrompt,
  hiringSignalPrompt,
  founderContentPrompt,
  type CompanyContext,
} from "./ai/prompts/company-research";
import {
  fitScoreSystemPrompt,
  fitScoreUserPrompt,
} from "./ai/prompts/fit-score";

const RESEARCH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESEARCH_FRESH_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type ResearchKind = "overview" | "hiringSignal" | "founderContent";

function cacheKey(pursuitId: string, kind: ResearchKind, prompt: string): string {
  return createHash("sha256").update(`${pursuitId}::${kind}::${prompt}`).digest("hex");
}

async function getCached(hash: string): Promise<ResearchEntry | null> {
  const row = await db.researchCache.findUnique({ where: { queryHash: hash } });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  let citations: { title: string; url: string }[] = [];
  if (row.citations) {
    try {
      citations = JSON.parse(row.citations) as { title: string; url: string }[];
    } catch {
      citations = [];
    }
  }
  return {
    text: row.result,
    citations,
    meta: { provider: "openai", model: "cache", latencyMs: 0 },
  };
}

async function setCached(args: {
  hash: string;
  pursuitId: string;
  kind: ResearchKind;
  prompt: string;
  entry: ResearchEntry;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + RESEARCH_TTL_MS);
  await db.researchCache.upsert({
    where: { queryHash: args.hash },
    update: {
      result: args.entry.text,
      citations: JSON.stringify(args.entry.citations),
      expiresAt,
      query: args.prompt,
      source: "openai",
    },
    create: {
      queryHash: args.hash,
      source: "openai",
      query: args.prompt,
      result: args.entry.text,
      citations: JSON.stringify(args.entry.citations),
      expiresAt,
    },
  });
  await logActivity({
    type: "research-cached",
    pursuitId: args.pursuitId,
    payload: { kind: args.kind },
  });
}

async function runOrCache(args: {
  pursuitId: string;
  kind: ResearchKind;
  prompt: string;
}): Promise<ResearchEntry> {
  const hash = cacheKey(args.pursuitId, args.kind, args.prompt);
  const cached = await getCached(hash);
  if (cached) return cached;

  const result = await webResearch({ prompt: args.prompt });
  const entry: ResearchEntry = {
    text: result.text,
    citations: result.citations.map((c) => ({ title: c.title, url: c.url })),
    meta: result.meta,
  };
  await setCached({
    hash,
    pursuitId: args.pursuitId,
    kind: args.kind,
    prompt: args.prompt,
    entry,
  });
  return entry;
}

/** True if existing research was refreshed within the freshness window. */
function isFresh(research: CompanyResearchJson | null): boolean {
  if (!research?.refreshedAt) return false;
  const refreshedMs = Date.parse(research.refreshedAt);
  if (Number.isNaN(refreshedMs)) return false;
  return Date.now() - refreshedMs < RESEARCH_FRESH_MS;
}

/**
 * Runs the 3-query research bundle for a Pursuit, packs into companyResearch
 * JSON, persists, then runs fact extraction + fit scoring.
 */
export async function researchPursuit(
  pursuitId: string,
  opts: { force?: boolean } = {},
): Promise<void> {
  const pursuit = await db.pursuit.findUniqueOrThrow({ where: { id: pursuitId } });
  const decoded = decodePursuit(pursuit);

  if (!opts.force && isFresh(decoded.companyResearch)) {
    return;
  }

  const ctx: CompanyContext = {
    name: pursuit.companyName,
    domain: pursuit.companyDomain ?? null,
  };

  const overviewQ = companyOverviewPrompt(ctx);
  const hiringQ = hiringSignalPrompt(ctx);
  const founderQ = founderContentPrompt(ctx);

  const [overview, hiringSignal, founderContent] = await Promise.all([
    runOrCache({ pursuitId, kind: "overview", prompt: overviewQ }),
    runOrCache({ pursuitId, kind: "hiringSignal", prompt: hiringQ }),
    runOrCache({ pursuitId, kind: "founderContent", prompt: founderQ }),
  ]);

  const now = new Date();
  const companyResearch: CompanyResearchJson = {
    overview,
    hiringSignal,
    founderContent,
    refreshedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + RESEARCH_TTL_MS).toISOString(),
  };

  await db.pursuit.update({
    where: { id: pursuitId },
    data: { companyResearch: JSON.stringify(companyResearch) },
  });

  await extractCompanyFactsFromOverview(pursuitId, overview.text);
  await scoreCompanyFit(pursuitId);
}

const FACT_EXTRACT_SYSTEM = `You extract structured facts from a short plain-English company overview. Output ONLY a JSON object with these keys: {"companyDomain": string|null, "headcount": string|null, "stage": string|null, "sector": string|null}. Use null when the fact is absent or unclear. companyDomain is the bare host (e.g., "stripe.com"), no protocol. Do not invent.`;

type ExtractedFacts = {
  companyDomain: string | null;
  headcount: string | null;
  stage: string | null;
  sector: string | null;
};

/**
 * Parses overview text into structured facts. Updates Pursuit.companyDomain
 * if currently null. Persists facts inside the companyResearch JSON.
 */
export async function extractCompanyFactsFromOverview(
  pursuitId: string,
  overviewText: string,
): Promise<void> {
  if (!overviewText.trim()) return;

  const { data } = await openaiJson<ExtractedFacts>({
    system: FACT_EXTRACT_SYSTEM,
    user: `OVERVIEW:\n${overviewText}\n\nReturn JSON only.`,
    model: "gpt-5.4-mini",
  });

  const pursuit = await db.pursuit.findUniqueOrThrow({ where: { id: pursuitId } });
  const decoded = decodePursuit(pursuit);

  const facts: CompanyResearchFacts = {
    headcount: data.headcount ?? null,
    stage: data.stage ?? null,
    sector: data.sector ?? null,
  };

  const companyResearch: CompanyResearchJson | null = decoded.companyResearch
    ? { ...decoded.companyResearch, facts }
    : null;

  const updateData: { companyDomain?: string; companyResearch?: string } = {};
  if (!pursuit.companyDomain && data.companyDomain) {
    updateData.companyDomain = data.companyDomain;
  }
  if (companyResearch) {
    updateData.companyResearch = JSON.stringify(companyResearch);
  }

  if (Object.keys(updateData).length > 0) {
    await db.pursuit.update({ where: { id: pursuitId }, data: updateData });
  }
}

type FitScoreResult = { score: number; reason: string };

/**
 * Scores Pursuit fit against the singleton Profile. Reads the decoded
 * companyResearch facts (sector/stage) when available. Persists score+reason
 * onto the Pursuit row.
 */
export async function scoreCompanyFit(pursuitId: string): Promise<void> {
  const pursuit = await db.pursuit.findUniqueOrThrow({ where: { id: pursuitId } });
  const decoded = decodePursuit(pursuit);
  const profile = await db.profile.findUnique({ where: { id: "singleton" } });

  const facts = decoded.companyResearch?.facts ?? null;

  const archetypes = profile?.archetypes
    ? safeParse(profile.archetypes)
    : null;

  const userPrompt = fitScoreUserPrompt({
    profile: {
      narrative: profile?.narrative ?? null,
      archetypes,
      cvMarkdown: profile?.cvMarkdown ?? null,
    },
    company: {
      name: pursuit.companyName,
      domain: pursuit.companyDomain ?? null,
      sector: facts?.sector ?? null,
      stage: facts?.stage ?? null,
    },
  });

  const { data } = await openaiJson<FitScoreResult>({
    system: fitScoreSystemPrompt(),
    user: userPrompt,
    model: "gpt-5.4-mini",
  });

  const score = clampScore(data.score);
  const reason = (data.reason ?? "").slice(0, 240);

  await db.pursuit.update({
    where: { id: pursuitId },
    data: { fitScore: score, fitReason: reason },
  });
}

function clampScore(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
