import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { claudeJson } from "@/server/services/ai/claude";

const messagesCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn(() => ({
      messages: { create: messagesCreate },
    })),
  };
});

beforeEach(() => {
  messagesCreate.mockReset();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("claudeJson", () => {
  it("returns parsed JSON when content is valid", async () => {
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"score": 87, "reason": "strong fit"}' }],
      model: "claude-sonnet-4-6",
      usage: {},
    });
    const result = await claudeJson<{ score: number; reason: string }>({
      system: "You return JSON.",
      user: "Score this company.",
      model: "claude-sonnet-4-6",
    });
    expect(result.data.score).toBe(87);
    expect(result.data.reason).toBe("strong fit");
    expect(result.meta.model).toBe("claude-sonnet-4-6");
  });

  it("strips ```json fences before parsing", async () => {
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: '```json\n{"x": 1}\n```' }],
      model: "claude-opus-4-7",
      usage: {},
    });
    const result = await claudeJson<{ x: number }>({
      user: "Return {x:1}",
      model: "claude-opus-4-7",
    });
    expect(result.data.x).toBe(1);
  });

  it("throws AiError on invalid JSON", async () => {
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "this is not json" }],
      model: "claude-sonnet-4-6",
      usage: {},
    });
    await expect(
      claudeJson({ user: "x", model: "claude-sonnet-4-6" }),
    ).rejects.toThrow(/JSON/i);
  });
});
