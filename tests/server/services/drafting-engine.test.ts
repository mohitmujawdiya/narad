import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import { draftOutreachWithAI } from "@/server/services/drafting-engine";

// Mock the AI adapter at the import-from-test path. Tests don't hit OpenAI.
vi.mock("@/server/services/ai/openai-chat", () => ({
  openaiJson: vi.fn(),
}));

import { openaiJson } from "@/server/services/ai/openai-chat";
const mockedOpenaiJson = vi.mocked(openaiJson);

async function clean(): Promise<void> {
  await db.activityLog.deleteMany({});
  await db.researchCache.deleteMany({});
  await db.pursuit.deleteMany({});
  await db.profile.deleteMany({});
}

beforeEach(async () => {
  await clean();
  mockedOpenaiJson.mockReset();
});

afterEach(async () => {
  await clean();
});

function cannedDraft(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      message: "Hi Jane,\n\nI saw your Mar 2026 post on infra cost — quick thought.\n\nBest,\nMohit",
      subject: "Quick thought on your infra-cost post",
      confidenceScore: 88,
      reasoning: "Names a specific recent post by date.",
      hookUsed: "Founder Mar 2026 LinkedIn post on infra cost",
      ...overrides,
    },
    meta: { provider: "openai" as const, model: "gpt-5.5", latencyMs: 12 },
  };
}

async function seedProfile(): Promise<void> {
  await db.profile.create({
    data: {
      id: "singleton",
      narrative: "Backend infra engineer",
      cvMarkdown: "# CV",
      archetypes: JSON.stringify([{ name: "infra", weight: 1 }]),
      visaDisclosurePolicy: "never-proactive",
      signature: "— Mohit",
    },
  });
}

describe("draftOutreachWithAI", () => {
  it("calls openaiJson with system + user containing pursuit fields and writes all 6 outreach columns", async () => {
    await seedProfile();
    const pursuit = await db.pursuit.create({
      data: {
        type: "company",
        companyName: "Acme Robotics",
        companyDomain: "acme.example",
        contactName: "Jane Doe",
        contactRole: "Founding Engineer",
        contactEmail: "jane@acme.example",
        notes: "Met at YC W26 demo day.",
      },
    });

    mockedOpenaiJson.mockResolvedValueOnce(cannedDraft() as never);

    const result = await draftOutreachWithAI({
      pursuitId: pursuit.id,
      channel: "email",
      goal: "Ask if they're open to a 15-min call.",
    });

    expect(mockedOpenaiJson).toHaveBeenCalledTimes(1);
    const callArg = mockedOpenaiJson.mock.calls[0][0] as {
      system: string;
      user: string;
      model: string;
    };
    expect(callArg.model).toBe("gpt-5.5");
    expect(callArg.system).toContain("CONFIDENCE RUBRIC");
    expect(callArg.user).toContain("Acme Robotics");
    expect(callArg.user).toContain("Jane Doe");
    expect(callArg.user).toContain("Founding Engineer");
    expect(callArg.user).toContain("acme.example");
    expect(callArg.user).toContain("Met at YC W26 demo day.");
    // No JD block for company pursuits
    expect(callArg.user).not.toContain("JOB POSTING CONTEXT");
    // Email channel guidance
    expect(callArg.user).toContain("CHANNEL: Email");
    // Goal block included
    expect(callArg.user).toContain("Ask if they're open to a 15-min call.");

    // Returned shape
    expect(result.subject).toBe("Quick thought on your infra-cost post");
    expect(result.body).toContain("Mar 2026");
    expect(result.confidence).toBe(88);
    expect(result.reasoning).toBe("Names a specific recent post by date.");
    expect(result.hookUsed).toBe("Founder Mar 2026 LinkedIn post on infra cost");

    // Pursuit row updated with all 6 outreach columns
    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
    expect(reloaded.outreachSubject).toBe("Quick thought on your infra-cost post");
    expect(reloaded.outreachBody).toContain("Mar 2026");
    expect(reloaded.outreachChannel).toBe("email");
    expect(reloaded.outreachConfidence).toBe(88);
    expect(reloaded.outreachReasoning).toBe("Names a specific recent post by date.");
    expect(reloaded.outreachHookUsed).toBe("Founder Mar 2026 LinkedIn post on infra cost");

    // One outreach-drafted activity
    const logs = await db.activityLog.findMany({
      where: { type: "outreach-drafted", pursuitId: pursuit.id },
    });
    expect(logs.length).toBe(1);
  });

  it("includes JD excerpt block in the user prompt for type='job' pursuits with jdMarkdown", async () => {
    await seedProfile();
    const pursuit = await db.pursuit.create({
      data: {
        type: "job",
        companyName: "Acme Robotics",
        contactName: "Jane Doe",
        jdTitle: "Founding Backend Engineer",
        jdUrl: "https://acme.example/jobs/123",
        jdMarkdown: "We are hiring a founding backend engineer to build our distributed control plane in Rust.",
      },
    });

    mockedOpenaiJson.mockResolvedValueOnce(cannedDraft() as never);

    await draftOutreachWithAI({
      pursuitId: pursuit.id,
      channel: "email",
    });

    const callArg = mockedOpenaiJson.mock.calls[0][0] as { user: string };
    expect(callArg.user).toContain("JOB POSTING CONTEXT");
    expect(callArg.user).toContain("Founding Backend Engineer");
    expect(callArg.user).toContain("distributed control plane in Rust");
  });

  it("does NOT include JD block for type='company' pursuits", async () => {
    await seedProfile();
    const pursuit = await db.pursuit.create({
      data: {
        type: "company",
        companyName: "Acme Robotics",
      },
    });

    mockedOpenaiJson.mockResolvedValueOnce(cannedDraft() as never);

    await draftOutreachWithAI({ pursuitId: pursuit.id, channel: "email" });

    const callArg = mockedOpenaiJson.mock.calls[0][0] as { user: string };
    expect(callArg.user).not.toContain("JOB POSTING CONTEXT");
  });

  it("clamps confidence into 0..100 and forces subject=null on linkedin channel", async () => {
    await seedProfile();
    const pursuit = await db.pursuit.create({
      data: { type: "company", companyName: "Acme Robotics" },
    });

    mockedOpenaiJson.mockResolvedValueOnce(
      cannedDraft({ confidenceScore: 250, subject: "should be discarded" }) as never,
    );

    const result = await draftOutreachWithAI({
      pursuitId: pursuit.id,
      channel: "linkedin",
    });

    expect(result.confidence).toBe(100);
    expect(result.subject).toBeNull();

    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
    expect(reloaded.outreachSubject).toBeNull();
    expect(reloaded.outreachChannel).toBe("linkedin");
    expect(reloaded.outreachConfidence).toBe(100);
  });
});
