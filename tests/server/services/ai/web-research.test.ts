import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { webResearch } from "@/server/services/ai/web-research";

const responsesCreate = vi.fn();
vi.mock("openai", () => {
  // Must be a real function (not arrow) so `new OpenAI()` works.
  function MockOpenAI() {
    return { responses: { create: responsesCreate } };
  }
  return { default: MockOpenAI };
});

beforeEach(() => {
  responsesCreate.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("webResearch", () => {
  it("returns a ResearchResult with text + citations from url_citation annotations", async () => {
    responsesCreate.mockResolvedValue({
      output_text: "Stripe is a fintech company headquartered in San Francisco.",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Stripe is a fintech company headquartered in San Francisco.",
              annotations: [
                { type: "url_citation", url: "https://stripe.com/about", title: "Stripe — About" },
                { type: "url_citation", url: "https://en.wikipedia.org/wiki/Stripe,_Inc.", title: "Stripe, Inc. — Wikipedia" },
              ],
            },
          ],
        },
      ],
    });

    const result = await webResearch({ prompt: "What is Stripe?" });
    expect(result.text).toContain("Stripe");
    expect(result.citations.length).toBe(2);
    expect(result.citations[0].url).toBe("https://stripe.com/about");
    expect(result.citations[0].title).toBe("Stripe — About");
    expect(result.meta.provider).toBe("openai");
    expect(result.meta.model).toBe("gpt-5.5");
  });

  it("returns empty citations when no url_citation annotations present", async () => {
    responsesCreate.mockResolvedValue({
      output_text: "x",
      output: [{ type: "message", content: [{ type: "output_text", text: "x", annotations: [] }] }],
    });
    const result = await webResearch({ prompt: "x" });
    expect(result.citations).toEqual([]);
  });

  it("throws AiError with kind=auth on 401", async () => {
    responsesCreate.mockRejectedValue(Object.assign(new Error("unauthorized"), { status: 401 }));
    await expect(webResearch({ prompt: "x" })).rejects.toThrow(/auth|unauthorized/i);
  });

  it("throws AiError with kind=rate-limit on 429", async () => {
    responsesCreate.mockRejectedValue(Object.assign(new Error("rate limited"), { status: 429 }));
    await expect(webResearch({ prompt: "x" })).rejects.toThrow();
  });
});
