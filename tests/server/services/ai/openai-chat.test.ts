import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openaiJson } from "@/server/services/ai/openai-chat";

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

describe("openaiJson", () => {
  it("returns parsed JSON when content is valid", async () => {
    responsesCreate.mockResolvedValue({
      output_text: '{"score": 87, "reason": "strong fit"}',
    });
    const result = await openaiJson<{ score: number; reason: string }>({
      system: "You return JSON.",
      user: "Score this company.",
      model: "gpt-5.4-mini",
    });
    expect(result.data.score).toBe(87);
    expect(result.data.reason).toBe("strong fit");
    expect(result.meta.model).toBe("gpt-5.4-mini");
    expect(result.meta.provider).toBe("openai");
  });

  it("strips ```json fences before parsing", async () => {
    responsesCreate.mockResolvedValue({
      output_text: '```json\n{"x": 1}\n```',
    });
    const result = await openaiJson<{ x: number }>({
      user: "Return {x:1}",
      model: "gpt-5.5",
    });
    expect(result.data.x).toBe(1);
  });

  it("throws AiError on invalid JSON", async () => {
    responsesCreate.mockResolvedValue({
      output_text: "this is not json",
    });
    await expect(
      openaiJson({ user: "x", model: "gpt-5.4-mini" }),
    ).rejects.toThrow(/JSON/i);
  });

  it("throws AiError with kind=auth on 401", async () => {
    responsesCreate.mockRejectedValue(Object.assign(new Error("unauthorized"), { status: 401 }));
    await expect(openaiJson({ user: "x", model: "gpt-5.5" })).rejects.toThrow(/auth|unauthorized/i);
  });
});
