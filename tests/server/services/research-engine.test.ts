import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import { researchCompany, refreshCompanyResearch } from "@/server/services/research-engine";

const webResearchMock = vi.fn();
vi.mock("@/server/services/ai/web-research", () => ({
  webResearch: (...args: unknown[]) => webResearchMock(...args),
}));

beforeAll(async () => {
  await db.profile.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
});

beforeEach(() => {
  webResearchMock.mockReset();
  webResearchMock.mockImplementation(async ({ prompt }: { prompt: string }) => ({
    text: `Result for: ${prompt.slice(0, 30)}`,
    citations: [{ title: "example.com", url: "https://example.com" }],
    meta: { provider: "openai" as const, model: "gpt-5.5", latencyMs: 100 },
  }));
});

afterEach(async () => {
  await db.researchCache.deleteMany();
  await db.companyResearch.deleteMany();
  await db.activityLog.deleteMany();
  await db.company.deleteMany();
});

describe("researchCompany", () => {
  it("runs 3 parallel queries on first call and writes CompanyResearch", async () => {
    const company = await db.company.create({
      data: { name: "Stripe", domain: "stripe.com" },
    });
    await researchCompany(company.id);
    expect(webResearchMock).toHaveBeenCalledTimes(3);
    const research = await db.companyResearch.findUniqueOrThrow({ where: { companyId: company.id } });
    expect(research.overview).toBeTruthy();
    expect(research.hiringSignal).toBeTruthy();
    expect(research.founderContent).toBeTruthy();
  });

  it("transitions company status from Discovered to Researched", async () => {
    const company = await db.company.create({
      data: { name: "Stripe", domain: "stripe.com" },
    });
    await researchCompany(company.id);
    const after = await db.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(after.status).toBe("Researched");
  });

  it("hits cache on second call (no extra OpenAI calls within 14d)", async () => {
    const company = await db.company.create({
      data: { name: "Stripe", domain: "stripe.com" },
    });
    await researchCompany(company.id);
    webResearchMock.mockClear();
    await researchCompany(company.id);
    expect(webResearchMock).toHaveBeenCalledTimes(0);
  });
});

describe("refreshCompanyResearch", () => {
  it("ignores cache and re-fetches", async () => {
    const company = await db.company.create({
      data: { name: "Stripe", domain: "stripe.com" },
    });
    await researchCompany(company.id);
    webResearchMock.mockClear();
    await refreshCompanyResearch(company.id);
    expect(webResearchMock).toHaveBeenCalledTimes(3);
  });
});
