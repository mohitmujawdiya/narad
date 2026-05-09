import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import { scoreCompanyFit } from "@/server/services/research-engine";

const openaiJsonMock = vi.fn();
vi.mock("@/server/services/ai/openai-chat", () => ({
  openaiJson: (...args: unknown[]) => openaiJsonMock(...args),
}));

beforeAll(async () => {
  await db.profile.upsert({
    where: { id: "singleton" },
    update: { cvMarkdown: "# CV\n\n- Built three AI products" },
    create: { id: "singleton", cvMarkdown: "# CV\n\n- Built three AI products" },
  });
});

beforeEach(() => {
  openaiJsonMock.mockReset();
});

afterEach(async () => {
  await db.activityLog.deleteMany();
  await db.company.deleteMany();
});

describe("scoreCompanyFit", () => {
  it("writes score + reason to Company on success", async () => {
    openaiJsonMock.mockResolvedValue({
      data: { score: 87, reason: "Strong AI/ML alignment" },
      meta: { provider: "openai", model: "gpt-5.4-mini", latencyMs: 100 },
    });

    const company = await db.company.create({ data: { name: "Stripe", domain: "stripe.com" } });
    const result = await scoreCompanyFit(company.id);

    expect(result?.score).toBe(87);
    const after = await db.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(after.fitScore).toBe(87);
    expect(after.fitReason).toBe("Strong AI/ML alignment");
  });

  it("returns null and doesn't update when no profile narrative or CV", async () => {
    await db.profile.update({
      where: { id: "singleton" },
      data: { cvMarkdown: null, narrative: null },
    });
    const company = await db.company.create({ data: { name: "X", domain: "x.com" } });
    const result = await scoreCompanyFit(company.id);
    expect(result).toBeNull();
    expect(openaiJsonMock).not.toHaveBeenCalled();
    // Restore for other tests
    await db.profile.update({
      where: { id: "singleton" },
      data: { cvMarkdown: "# CV" },
    });
  });

  it("does not throw if OpenAI errors", async () => {
    openaiJsonMock.mockRejectedValue(new Error("rate limit"));
    const company = await db.company.create({ data: { name: "Y", domain: "y.com" } });
    const result = await scoreCompanyFit(company.id);
    expect(result).toBeNull();
    const after = await db.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(after.fitScore).toBeNull();
  });
});
