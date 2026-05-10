import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import {
  researchPursuit,
  extractCompanyFactsFromOverview,
  scoreCompanyFit,
} from "@/server/services/research-engine";
import { decodePursuit } from "@/server/types/pursuit";

// Mock the AI adapters at the import-from-test path. Tests don't hit OpenAI.
vi.mock("@/server/services/ai/web-research", () => ({
  webResearch: vi.fn(),
}));
vi.mock("@/server/services/ai/openai-chat", () => ({
  openaiJson: vi.fn(),
}));

// Re-import the mocked symbols so we can drive them.
import { webResearch } from "@/server/services/ai/web-research";
import { openaiJson } from "@/server/services/ai/openai-chat";

const mockedWebResearch = vi.mocked(webResearch);
const mockedOpenaiJson = vi.mocked(openaiJson);

async function clean(): Promise<void> {
  await db.activityLog.deleteMany({});
  await db.researchCache.deleteMany({});
  await db.pursuit.deleteMany({});
  await db.profile.deleteMany({});
}

beforeEach(async () => {
  await clean();
  mockedWebResearch.mockReset();
  mockedOpenaiJson.mockReset();
});

afterEach(async () => {
  await clean();
});

function cannedWebResult(text: string) {
  return {
    text,
    citations: [{ title: "Source", url: "https://example.com/" + encodeURIComponent(text.slice(0, 8)) }],
    meta: { provider: "openai" as const, model: "gpt-5.5", latencyMs: 12 },
  };
}

describe("researchPursuit", () => {
  it("runs 3 webResearch calls, packs companyResearch JSON, populates fitScore", async () => {
    const pursuit = await db.pursuit.create({
      data: { type: "company", companyName: "Acme Robotics" },
    });
    await db.profile.create({
      data: {
        id: "singleton",
        narrative: "Backend infra engineer",
        cvMarkdown: "# CV",
        archetypes: JSON.stringify([{ name: "infra", weight: 1 }]),
      },
    });

    mockedWebResearch
      .mockResolvedValueOnce(cannedWebResult("OVERVIEW: Acme builds robots."))
      .mockResolvedValueOnce(cannedWebResult("HIRING: 3 SWE roles posted."))
      .mockResolvedValueOnce(cannedWebResult("FOUNDER: Recent post about logistics."));

    // First openaiJson call = fact extraction; second = fit score.
    mockedOpenaiJson
      .mockResolvedValueOnce({
        data: {
          companyDomain: "acme.example",
          headcount: "11-50",
          stage: "Series A",
          sector: "robotics",
        },
        meta: { provider: "openai", model: "gpt-5.4-mini", latencyMs: 8 },
      } as never)
      .mockResolvedValueOnce({
        data: { score: 82, reason: "infra-heavy robotics company aligns with backend background" },
        meta: { provider: "openai", model: "gpt-5.4-mini", latencyMs: 8 },
      } as never);

    await researchPursuit(pursuit.id);

    expect(mockedWebResearch).toHaveBeenCalledTimes(3);

    const updated = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
    const decoded = decodePursuit(updated);

    expect(decoded.companyResearch).not.toBeNull();
    expect(decoded.companyResearch?.overview?.text).toContain("OVERVIEW");
    expect(decoded.companyResearch?.hiringSignal?.text).toContain("HIRING");
    expect(decoded.companyResearch?.founderContent?.text).toContain("FOUNDER");
    expect(decoded.companyResearch?.refreshedAt).toBeTruthy();
    expect(decoded.companyResearch?.expiresAt).toBeTruthy();
    expect(decoded.companyResearch?.facts?.sector).toBe("robotics");
    expect(decoded.companyResearch?.facts?.stage).toBe("Series A");

    expect(updated.companyDomain).toBe("acme.example");
    expect(updated.fitScore).toBe(82);
    expect(updated.fitReason).toContain("robotics");

    // 3 research-cached activity entries (one per kind).
    const logs = await db.activityLog.findMany({ where: { type: "research-cached", pursuitId: pursuit.id } });
    expect(logs.length).toBe(3);
  });

  it("reuses cache on second call (no new webResearch invocations)", async () => {
    const pursuit = await db.pursuit.create({
      data: { type: "company", companyName: "Acme Robotics" },
    });
    await db.profile.create({
      data: {
        id: "singleton",
        narrative: "Backend infra engineer",
        cvMarkdown: "# CV",
        archetypes: null,
      },
    });

    mockedWebResearch
      .mockResolvedValueOnce(cannedWebResult("OVERVIEW: Acme builds robots."))
      .mockResolvedValueOnce(cannedWebResult("HIRING: 3 SWE roles posted."))
      .mockResolvedValueOnce(cannedWebResult("FOUNDER: Recent post about logistics."));

    // First-run JSON calls: extract + fit
    mockedOpenaiJson
      .mockResolvedValueOnce({
        data: { companyDomain: null, headcount: null, stage: null, sector: null },
        meta: { provider: "openai", model: "gpt-5.4-mini", latencyMs: 8 },
      } as never)
      .mockResolvedValueOnce({
        data: { score: 50, reason: "neutral" },
        meta: { provider: "openai", model: "gpt-5.4-mini", latencyMs: 8 },
      } as never);

    await researchPursuit(pursuit.id);
    expect(mockedWebResearch).toHaveBeenCalledTimes(3);

    // Force the freshness check to fail by clearing companyResearch back to null
    // — but keep ResearchCache rows so the second call should re-hydrate from cache.
    await db.pursuit.update({
      where: { id: pursuit.id },
      data: { companyResearch: null },
    });

    // Second-run JSON calls: extract + fit (called again because companyResearch was nulled).
    mockedOpenaiJson
      .mockResolvedValueOnce({
        data: { companyDomain: null, headcount: null, stage: null, sector: null },
        meta: { provider: "openai", model: "gpt-5.4-mini", latencyMs: 8 },
      } as never)
      .mockResolvedValueOnce({
        data: { score: 50, reason: "neutral" },
        meta: { provider: "openai", model: "gpt-5.4-mini", latencyMs: 8 },
      } as never);

    await researchPursuit(pursuit.id);

    // webResearch must NOT have been called again — cache hit on all 3 keys.
    expect(mockedWebResearch).toHaveBeenCalledTimes(3);

    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
    const decoded = decodePursuit(reloaded);
    expect(decoded.companyResearch?.overview?.text).toContain("OVERVIEW");
  });

  it("skips the run when companyResearch is fresh and force is not set", async () => {
    const pursuit = await db.pursuit.create({
      data: { type: "company", companyName: "Acme Robotics" },
    });
    await db.profile.create({
      data: { id: "singleton", narrative: null, cvMarkdown: null, archetypes: null },
    });

    const freshResearch = {
      overview: { text: "stale-overview", citations: [], meta: { provider: "openai", model: "x", latencyMs: 0 } },
      hiringSignal: null,
      founderContent: null,
      refreshedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
    await db.pursuit.update({
      where: { id: pursuit.id },
      data: { companyResearch: JSON.stringify(freshResearch) },
    });

    await researchPursuit(pursuit.id);
    expect(mockedWebResearch).toHaveBeenCalledTimes(0);
    expect(mockedOpenaiJson).toHaveBeenCalledTimes(0);
  });
});

describe("extractCompanyFactsFromOverview", () => {
  it("populates companyDomain when null and writes facts into companyResearch", async () => {
    const pursuit = await db.pursuit.create({
      data: {
        type: "company",
        companyName: "Acme",
        companyResearch: JSON.stringify({
          overview: { text: "x", citations: [], meta: { provider: "openai", model: "x", latencyMs: 0 } },
          hiringSignal: null,
          founderContent: null,
          refreshedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 1000).toISOString(),
        }),
      },
    });

    mockedOpenaiJson.mockResolvedValueOnce({
      data: {
        companyDomain: "acme.example",
        headcount: "11-50",
        stage: "Seed",
        sector: "robotics",
      },
      meta: { provider: "openai", model: "gpt-5.4-mini", latencyMs: 8 },
    } as never);

    await extractCompanyFactsFromOverview(pursuit.id, "Acme is a robotics startup at seed.");

    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
    expect(reloaded.companyDomain).toBe("acme.example");
    const decoded = decodePursuit(reloaded);
    expect(decoded.companyResearch?.facts?.sector).toBe("robotics");
    expect(decoded.companyResearch?.facts?.stage).toBe("Seed");
    expect(decoded.companyResearch?.facts?.headcount).toBe("11-50");
  });

  it("does not overwrite companyDomain if already set", async () => {
    const pursuit = await db.pursuit.create({
      data: {
        type: "company",
        companyName: "Acme",
        companyDomain: "preset.example",
      },
    });

    mockedOpenaiJson.mockResolvedValueOnce({
      data: {
        companyDomain: "extracted.example",
        headcount: null,
        stage: null,
        sector: null,
      },
      meta: { provider: "openai", model: "gpt-5.4-mini", latencyMs: 8 },
    } as never);

    await extractCompanyFactsFromOverview(pursuit.id, "Some overview text.");

    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
    expect(reloaded.companyDomain).toBe("preset.example");
  });
});

describe("scoreCompanyFit", () => {
  it("writes fitScore (clamped 0-100) and fitReason", async () => {
    const pursuit = await db.pursuit.create({
      data: { type: "company", companyName: "Acme" },
    });
    await db.profile.create({
      data: {
        id: "singleton",
        narrative: "infra engineer",
        cvMarkdown: "CV",
        archetypes: JSON.stringify([{ name: "infra", weight: 1 }]),
      },
    });

    mockedOpenaiJson.mockResolvedValueOnce({
      data: { score: 250, reason: "very strong" },
      meta: { provider: "openai", model: "gpt-5.4-mini", latencyMs: 8 },
    } as never);

    await scoreCompanyFit(pursuit.id);

    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
    expect(reloaded.fitScore).toBe(100);
    expect(reloaded.fitReason).toBe("very strong");
  });
});
