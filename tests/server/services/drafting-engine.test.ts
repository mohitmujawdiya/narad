import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import { draftMessageWithAI } from "@/server/services/drafting-engine";

const openaiJsonMock = vi.fn();
vi.mock("@/server/services/ai/openai-chat", () => ({
  openaiJson: (...args: unknown[]) => openaiJsonMock(...args),
}));

beforeAll(async () => {
  await db.profile.upsert({
    where: { id: "singleton" },
    update: { narrative: "AI builder", signature: "— Mohit" },
    create: { id: "singleton", narrative: "AI builder", signature: "— Mohit" },
  });
});

beforeEach(() => {
  openaiJsonMock.mockReset();
});

afterEach(async () => {
  await db.message.deleteMany();
  await db.touchpoint.deleteMany();
  await db.contact.deleteMany();
  await db.company.deleteMany();
});

async function setup() {
  const company = await db.company.create({ data: { name: "Stripe", domain: "stripe.com", sector: "fintech" } });
  const contact = await db.contact.create({
    data: { companyId: company.id, name: "Jane Doe", role: "PM", email: "jane@stripe.com" },
  });
  const template = await db.template.findFirstOrThrow({ where: { name: "linkedin-peer" } });
  return { company, contact, template };
}

describe("draftMessageWithAI", () => {
  it("creates a Drafted Touchpoint with OpenAI output", async () => {
    const { contact, template } = await setup();
    openaiJsonMock.mockResolvedValue({
      data: {
        message: "Hi Jane — saw the recent Stripe Issuing post...",
        subject: null,
        confidenceScore: 82,
        reasoning: "Founder's recent post on infra cost is a strong hook",
        hookUsed: "Founder Mar 2026 post on Stripe Issuing infra",
      },
      meta: { provider: "openai", model: "gpt-5.5", latencyMs: 1200 },
    });

    const tp = await draftMessageWithAI({ contactId: contact.id, templateId: template.id });

    expect(tp.status).toBe("Drafted");
    expect(tp.message?.body).toContain("Stripe Issuing");
    expect(tp.message?.draftConfidence).toBe(82);
    expect(tp.message?.draftedBy).toBe("gpt-5.5");
    expect(tp.message?.reasoning).toContain("hook");
  });

  it("clamps confidence to 0-100 if model returns out-of-range", async () => {
    const { contact, template } = await setup();
    openaiJsonMock.mockResolvedValue({
      data: {
        message: "x",
        subject: null,
        confidenceScore: 150,
        reasoning: "r",
        hookUsed: "h",
      },
      meta: { provider: "openai", model: "gpt-5.5", latencyMs: 100 },
    });
    const tp = await draftMessageWithAI({ contactId: contact.id, templateId: template.id });
    expect(tp.message?.draftConfidence).toBe(100);
  });

  it("logs activity with type touchpoint-drafted", async () => {
    const { contact, template } = await setup();
    openaiJsonMock.mockResolvedValue({
      data: { message: "x", subject: null, confidenceScore: 80, reasoning: "r", hookUsed: "h" },
      meta: { provider: "openai", model: "gpt-5.5", latencyMs: 100 },
    });
    await draftMessageWithAI({ contactId: contact.id, templateId: template.id });
    const logs = await db.activityLog.findMany({ where: { contactId: contact.id } });
    expect(logs.some((l) => l.type === "touchpoint-drafted")).toBe(true);
  });
});
