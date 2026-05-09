import { describe, it, expect, vi, beforeEach } from "vitest";
import { wellfoundParser } from "@/server/services/parsers/wellfound";

const webResearchMock = vi.fn();
vi.mock("@/server/services/ai/web-research", () => ({
  webResearch: (...args: unknown[]) => webResearchMock(...args),
}));

beforeEach(() => {
  webResearchMock.mockReset();
});

describe("wellfoundParser", () => {
  it("matches Wellfound company/search URLs", () => {
    expect(wellfoundParser.matches("https://wellfound.com/discover")).toBe(true);
    expect(wellfoundParser.matches("wellfound.com/jobs")).toBe(true);
    expect(wellfoundParser.matches("https://stripe.com")).toBe(false);
  });

  it("parses companies from webResearch response", async () => {
    webResearchMock.mockResolvedValue({
      text: JSON.stringify({
        companies: [{ name: "Foo", domain: "foo.com", sector: "AI", stage: "series-a" }],
      }),
      citations: [],
      meta: { provider: "openai", model: "gpt-5.5", latencyMs: 100 },
    });
    const out = await wellfoundParser.parse("https://wellfound.com/discover?industry=ai");
    expect(out[0].name).toBe("Foo");
    expect(out[0].hint).toBe("Wellfound");
  });
});
