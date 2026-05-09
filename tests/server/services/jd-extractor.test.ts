import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractJd } from "@/server/services/jd-extractor";

// Mock the AI adapter at the import-from-test path. Tests don't hit OpenAI.
vi.mock("@/server/services/ai/web-research", () => ({
  webResearch: vi.fn(),
}));

import { webResearch } from "@/server/services/ai/web-research";
const mockedWebResearch = vi.mocked(webResearch);

function cannedResult(text: string) {
  return {
    text,
    citations: [],
    meta: { provider: "openai" as const, model: "gpt-5.5", latencyMs: 12 },
  };
}

const HAPPY_PAYLOAD = {
  title: "Backend Engineer",
  companyName: "Acme Robotics",
  companyDomain: "acme.example",
  location: "Remote (US)",
  comp: "$140k–$180k",
  deadline: null,
  requirementsParsed: ["3+ years Python", "Distributed systems experience"],
  jdMarkdown: "# Backend Engineer\n\nWe are looking for...",
};

beforeEach(() => {
  mockedWebResearch.mockReset();
});

describe("extractJd", () => {
  it("returns the parsed JD shape on a happy-path response", async () => {
    mockedWebResearch.mockResolvedValueOnce(cannedResult(JSON.stringify(HAPPY_PAYLOAD)));

    const result = await extractJd("https://example.com/jobs/backend");

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Backend Engineer");
    expect(result?.companyName).toBe("Acme Robotics");
    expect(result?.companyDomain).toBe("acme.example");
    expect(result?.requirementsParsed).toHaveLength(2);
    expect(result?.jdMarkdown).toContain("# Backend Engineer");
  });

  it("strips ```json code fences before parsing", async () => {
    const fenced = "```json\n" + JSON.stringify(HAPPY_PAYLOAD) + "\n```";
    mockedWebResearch.mockResolvedValueOnce(cannedResult(fenced));

    const result = await extractJd("https://example.com/jobs/backend");

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Backend Engineer");
  });

  it("strips bare ``` code fences before parsing", async () => {
    const fenced = "```\n" + JSON.stringify(HAPPY_PAYLOAD) + "\n```";
    mockedWebResearch.mockResolvedValueOnce(cannedResult(fenced));

    const result = await extractJd("https://example.com/jobs/backend");

    expect(result).not.toBeNull();
    expect(result?.companyName).toBe("Acme Robotics");
  });

  it("returns null when the LLM signals it could not access the URL", async () => {
    mockedWebResearch.mockResolvedValueOnce(
      cannedResult(JSON.stringify({ error: "could not access" })),
    );

    const result = await extractJd("https://example.com/private");

    expect(result).toBeNull();
  });

  it("returns null on malformed JSON", async () => {
    mockedWebResearch.mockResolvedValueOnce(cannedResult("not json at all { ["));

    const result = await extractJd("https://example.com/jobs/backend");

    expect(result).toBeNull();
  });

  it("returns null when the underlying webResearch call throws", async () => {
    mockedWebResearch.mockRejectedValueOnce(new Error("network"));

    const result = await extractJd("https://example.com/jobs/backend");

    expect(result).toBeNull();
  });
});
