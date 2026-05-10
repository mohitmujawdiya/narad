import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import { parseAndImport } from "@/server/services/source-importer";

// Mock heavy collaborators so tests don't hit OpenAI or do real research.
vi.mock("@/server/services/jd-extractor", () => ({
  extractJd: vi.fn(),
}));
vi.mock("@/server/services/research-engine", () => ({
  researchPursuit: vi.fn(),
}));
vi.mock("@/server/services/jd-artifacts", () => ({
  generateJdEvaluation: vi.fn(),
}));

import { extractJd } from "@/server/services/jd-extractor";
import { researchPursuit } from "@/server/services/research-engine";
import { generateJdEvaluation } from "@/server/services/jd-artifacts";

const mockedExtractJd = vi.mocked(extractJd);
const mockedResearchPursuit = vi.mocked(researchPursuit);
const mockedGenerateJdEvaluation = vi.mocked(generateJdEvaluation);

async function clean(): Promise<void> {
  await db.activityLog.deleteMany({});
  await db.researchCache.deleteMany({});
  await db.pursuit.deleteMany({});
  await db.profile.deleteMany({});
}

/** Wait one macrotask so fire-and-forget background jobs flush. */
async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await clean();
  mockedExtractJd.mockReset();
  mockedResearchPursuit.mockReset();
  mockedGenerateJdEvaluation.mockReset();
  // Default: succeed silently.
  mockedResearchPursuit.mockResolvedValue(undefined);
  mockedGenerateJdEvaluation.mockResolvedValue("# eval");
});

afterEach(async () => {
  await clean();
});

describe("parseAndImport", () => {
  it("imports a single-URL company target, kicks off research, no JD eval", async () => {
    const result = await parseAndImport("https://acme.example");
    await flushMicrotasks();

    expect(result.format).toBe("single-url");
    expect(result.parsed).toBe(1);
    expect(result.inserted).toBe(1);
    expect(result.pursuitIds).toHaveLength(1);
    expect(result.errors).toEqual([]);

    const row = await db.pursuit.findUniqueOrThrow({ where: { id: result.pursuitIds[0]! } });
    expect(row.type).toBe("company");
    expect(row.companyName).toBe("Acme");
    expect(row.companyDomain).toBe("acme.example");
    expect(row.pastedUrl).toBe("https://acme.example");
    expect(row.jdUrl).toBeNull();

    expect(mockedResearchPursuit).toHaveBeenCalledTimes(1);
    expect(mockedResearchPursuit).toHaveBeenCalledWith(row.id);
    expect(mockedGenerateJdEvaluation).not.toHaveBeenCalled();

    const logs = await db.activityLog.findMany({
      where: { type: "pursuit-created", pursuitId: row.id },
    });
    expect(logs.length).toBe(1);
    const payload = JSON.parse(logs[0]!.payload!);
    expect(payload.type).toBe("company");
    expect(payload.source).toBe("single-url");
  });

  it("imports a JD URL, sets type=job + jdUrl, kicks off both research + JD eval", async () => {
    mockedExtractJd.mockResolvedValueOnce({
      title: "Backend Engineer",
      companyName: "Acme Robotics",
      companyDomain: "acme.example",
      location: null,
      comp: null,
      deadline: null,
      requirementsParsed: [],
      jdMarkdown: "# Backend Engineer\n\nText...",
    });

    const result = await parseAndImport("https://jobs.lever.co/acme/be-eng");
    await flushMicrotasks();

    expect(result.format).toBe("jd-url");
    expect(result.parsed).toBe(1);
    expect(result.inserted).toBe(1);
    expect(result.errors).toEqual([]);

    const row = await db.pursuit.findUniqueOrThrow({ where: { id: result.pursuitIds[0]! } });
    expect(row.type).toBe("job");
    expect(row.companyName).toBe("Acme Robotics");
    expect(row.companyDomain).toBe("acme.example");
    expect(row.jdUrl).toBe("https://jobs.lever.co/acme/be-eng");
    expect(row.pastedUrl).toBe("https://jobs.lever.co/acme/be-eng");
    // jd parser puts title in `hint`, which the importer maps to `notes`
    expect(row.notes).toBe("Backend Engineer");

    expect(mockedResearchPursuit).toHaveBeenCalledTimes(1);
    expect(mockedResearchPursuit).toHaveBeenCalledWith(row.id);
    expect(mockedGenerateJdEvaluation).toHaveBeenCalledTimes(1);
    expect(mockedGenerateJdEvaluation).toHaveBeenCalledWith(row.id);
  });

  it("imports CSV with mixed company + job rows", async () => {
    const csv = [
      "companyName,domain,jdUrl",
      "Acme Robotics,acme.example,",
      "Globex,globex.example,https://globex.example/jobs/123",
    ].join("\n");

    const result = await parseAndImport(csv);
    await flushMicrotasks();

    expect(result.format).toBe("csv");
    expect(result.parsed).toBe(2);
    expect(result.inserted).toBe(2);
    expect(result.errors).toEqual([]);

    const rows = await db.pursuit.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.companyName).toBe("Acme Robotics");
    expect(rows[0]!.type).toBe("company");
    expect(rows[0]!.jdUrl).toBeNull();
    expect(rows[1]!.companyName).toBe("Globex");
    expect(rows[1]!.type).toBe("job");
    expect(rows[1]!.jdUrl).toBe("https://globex.example/jobs/123");

    expect(mockedResearchPursuit).toHaveBeenCalledTimes(2);
    // JD eval only fires for the job row
    expect(mockedGenerateJdEvaluation).toHaveBeenCalledTimes(1);
    expect(mockedGenerateJdEvaluation).toHaveBeenCalledWith(rows[1]!.id);
  });

  it("imports a URL list with 3 URLs", async () => {
    const list = [
      "https://acme.example",
      "https://globex.example",
      "https://initech.example",
    ].join("\n");

    const result = await parseAndImport(list);
    await flushMicrotasks();

    expect(result.format).toBe("url-list");
    expect(result.parsed).toBe(3);
    expect(result.inserted).toBe(3);
    expect(result.errors).toEqual([]);

    const rows = await db.pursuit.findMany();
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.type === "company")).toBe(true);

    expect(mockedResearchPursuit).toHaveBeenCalledTimes(3);
    expect(mockedGenerateJdEvaluation).not.toHaveBeenCalled();
  });

  it("returns errors and creates no Pursuits when the parser throws", async () => {
    mockedExtractJd.mockRejectedValueOnce(new Error("boom from JD parser"));

    const result = await parseAndImport("https://jobs.lever.co/acme/be-eng");
    await flushMicrotasks();

    expect(result.format).toBe("jd-url");
    expect(result.parsed).toBe(0);
    expect(result.inserted).toBe(0);
    expect(result.pursuitIds).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("boom from JD parser");

    const rows = await db.pursuit.findMany();
    expect(rows).toHaveLength(0);
    expect(mockedResearchPursuit).not.toHaveBeenCalled();
    expect(mockedGenerateJdEvaluation).not.toHaveBeenCalled();
  });

  it("continues the batch when one row's DB insert fails", async () => {
    // Override db.pursuit.create to fail on the second call only.
    const realCreate = db.pursuit.create.bind(db.pursuit);
    let call = 0;
    const spy = vi
      .spyOn(db.pursuit, "create")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(((args: any) => {
        call++;
        if (call === 2) {
          return Promise.reject(new Error("simulated DB failure"));
        }
        return realCreate(args);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any);

    const list = [
      "https://acme.example",
      "https://globex.example",
      "https://initech.example",
    ].join("\n");

    const result = await parseAndImport(list);
    await flushMicrotasks();

    expect(result.format).toBe("url-list");
    expect(result.parsed).toBe(3);
    expect(result.inserted).toBe(2);
    expect(result.pursuitIds).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Globex");
    expect(result.errors[0]).toContain("simulated DB failure");

    spy.mockRestore();

    const rows = await db.pursuit.findMany();
    expect(rows).toHaveLength(2);
    // Background jobs only fire for successful inserts.
    expect(mockedResearchPursuit).toHaveBeenCalledTimes(2);
  });
});
