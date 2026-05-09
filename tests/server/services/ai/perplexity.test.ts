import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { perplexityResearch } from "@/server/services/ai/perplexity";

const MOCK_RESPONSE = {
  id: "x",
  model: "sonar-pro",
  choices: [
    {
      message: {
        role: "assistant",
        content: "Stripe is a fintech company headquartered in San Francisco.",
      },
      finish_reason: "stop",
    },
  ],
  citations: ["https://stripe.com/about", "https://en.wikipedia.org/wiki/Stripe,_Inc."],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200, headers: { "content-type": "application/json" } }),
    ),
  );
  vi.stubEnv("PERPLEXITY_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("perplexityResearch", () => {
  it("returns a ResearchResult with text + citations", async () => {
    const result = await perplexityResearch({ prompt: "What is Stripe?" });
    expect(result.text).toContain("Stripe");
    expect(result.citations.length).toBe(2);
    expect(result.citations[0].url).toBe("https://stripe.com/about");
    expect(result.meta.provider).toBe("perplexity");
    expect(result.meta.model).toBe("sonar-pro");
  });

  it("throws AiError with kind=auth on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })),
    );
    await expect(perplexityResearch({ prompt: "x" })).rejects.toThrow(/401|auth/i);
  });

  it("throws AiError with kind=rate-limit on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate", { status: 429 })),
    );
    await expect(perplexityResearch({ prompt: "x" })).rejects.toThrow();
  });
});
