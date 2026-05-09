import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ycParser } from "@/server/services/parsers/yc";

const webResearchMock = vi.fn();
vi.mock("@/server/services/ai/web-research", () => ({
  webResearch: (...args: unknown[]) => webResearchMock(...args),
}));

beforeEach(() => {
  webResearchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ycParser", () => {
  it("matches YC company URLs", () => {
    expect(ycParser.matches("https://www.ycombinator.com/companies?batch=W26")).toBe(true);
    expect(ycParser.matches("ycombinator.com/companies?batch=S25")).toBe(true);
    expect(ycParser.matches("https://stripe.com")).toBe(false);
  });

  it("parses companies from a webResearch-extracted list", async () => {
    webResearchMock.mockResolvedValue({
      text: JSON.stringify({
        companies: [
          { name: "Acme AI", domain: "acmeai.com", sector: "AI", stage: "seed" },
          { name: "Beta Corp", domain: "beta.io", sector: "fintech", stage: "seed" },
        ],
      }),
      citations: [],
      meta: { provider: "openai", model: "gpt-5.5", latencyMs: 1000 },
    });

    const out = await ycParser.parse("https://www.ycombinator.com/companies?batch=W26");
    expect(out.length).toBe(2);
    expect(out[0]).toEqual({
      name: "Acme AI",
      domain: "acmeai.com",
      sourceUrl: "https://www.ycombinator.com/companies?batch=W26",
      sector: "AI",
      stage: "seed",
      hint: "YC W26",
    });
  });

  it("returns [] gracefully on malformed response", async () => {
    webResearchMock.mockResolvedValue({
      text: "I couldn't find the batch.",
      citations: [],
      meta: { provider: "openai", model: "gpt-5.5", latencyMs: 100 },
    });
    const out = await ycParser.parse("https://www.ycombinator.com/companies?batch=W99");
    expect(out).toEqual([]);
  });
});
