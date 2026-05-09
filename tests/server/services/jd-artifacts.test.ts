import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import {
  generateJdEvaluation,
  generateCvVariant,
  generateCoverLetter,
} from "@/server/services/jd-artifacts";

// Mock the AI adapter — tests don't hit OpenAI.
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

async function seedProfile(opts: { withCv?: boolean } = {}): Promise<void> {
  await db.profile.create({
    data: {
      id: "singleton",
      narrative: "Backend infra engineer with founding-engineer experience.",
      cvMarkdown: opts.withCv === false ? null : "# CV\n\n## Experience\n- Built X serving Y.",
      archetypes: JSON.stringify([{ name: "infra", weight: 1 }]),
      visaDisclosurePolicy: "never-proactive",
      signature: "— Mohit",
    },
  });
}

async function seedJobPursuit(opts: { withJd?: boolean } = {}): Promise<string> {
  const pursuit = await db.pursuit.create({
    data: {
      type: "job",
      companyName: "Acme Robotics",
      companyDomain: "acme.example",
      jdTitle: "Founding Backend Engineer",
      jdUrl: "https://acme.example/jobs/123",
      jdMarkdown: opts.withJd === false ? null : "We are hiring a founding backend engineer to build our distributed control plane in Rust.",
    },
  });
  return pursuit.id;
}

function meta() {
  return { provider: "openai" as const, model: "gpt-5.5", latencyMs: 12 };
}

describe("generateJdEvaluation", () => {
  it("calls openaiJson, persists markdown to jdEvaluation, and logs jd-evaluated", async () => {
    await seedProfile();
    const pursuitId = await seedJobPursuit();

    const markdown = "## A) Role Summary\n| field | value |\n|---|---|\n| title | Founding Backend Engineer |\n\n## B) Match with CV\nStrong infra alignment. Cited: 'distributed control plane in Rust'.\n\n## Global Score\n4/5 — solid fit with surgical edits.";
    mockedOpenaiJson.mockResolvedValueOnce({
      data: { markdown },
      meta: meta(),
    } as never);

    const result = await generateJdEvaluation(pursuitId);

    expect(mockedOpenaiJson).toHaveBeenCalledTimes(1);
    const callArg = mockedOpenaiJson.mock.calls[0][0] as {
      system: string;
      user: string;
      model: string;
    };
    expect(callArg.model).toBe("gpt-5.5");
    expect(callArg.system).toContain("A) Role Summary");
    expect(callArg.system).toContain("Global Score");
    expect(callArg.user).toContain("distributed control plane in Rust");

    expect(result).toBe(markdown);

    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuitId } });
    expect(reloaded.jdEvaluation).toBe(markdown);

    const logs = await db.activityLog.findMany({
      where: { type: "jd-evaluated", pursuitId },
    });
    expect(logs.length).toBe(1);
  });

  it("throws when pursuit has no jdMarkdown", async () => {
    await seedProfile();
    const pursuitId = await seedJobPursuit({ withJd: false });

    await expect(generateJdEvaluation(pursuitId)).rejects.toThrow(/jdMarkdown/);
    expect(mockedOpenaiJson).not.toHaveBeenCalled();
  });

  it("throws when profile has no cvMarkdown", async () => {
    await seedProfile({ withCv: false });
    const pursuitId = await seedJobPursuit();

    await expect(generateJdEvaluation(pursuitId)).rejects.toThrow(/cvMarkdown/);
    expect(mockedOpenaiJson).not.toHaveBeenCalled();
  });
});

describe("generateCvVariant", () => {
  it("calls openaiJson, persists JSON to cvVariant, and logs cv-variant-generated", async () => {
    await seedProfile();
    const pursuitId = await seedJobPursuit();

    const cvVariant = {
      edits: [
        {
          section: "Experience > Hannibal",
          current: "Built distributed system",
          proposed: "Accomplished 10x throughput as measured by 1M req/s by rebuilding control plane in Rust",
          rationale: "JD names Rust + distributed control plane verbatim.",
        },
        {
          section: "Skills",
          current: "Languages: TS, Python",
          proposed: "Languages: Rust, TypeScript, Python",
          rationale: "Rust is in JD requirements.",
        },
      ],
      summary: "Five surgical edits aligning CV with JD's Rust + distributed-systems requirements.",
    };

    mockedOpenaiJson.mockResolvedValueOnce({
      data: cvVariant,
      meta: meta(),
    } as never);

    const result = await generateCvVariant(pursuitId);

    expect(mockedOpenaiJson).toHaveBeenCalledTimes(1);
    const callArg = mockedOpenaiJson.mock.calls[0][0] as {
      system: string;
      user: string;
      model: string;
    };
    expect(callArg.model).toBe("gpt-5.5");
    expect(callArg.system).toContain("XYZ formula");
    expect(callArg.user).toContain("distributed control plane in Rust");

    expect(result.edits.length).toBe(2);
    expect(result.summary).toContain("surgical");

    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuitId } });
    expect(reloaded.cvVariant).not.toBeNull();
    const decoded = JSON.parse(reloaded.cvVariant ?? "");
    expect(decoded.edits[0].section).toBe("Experience > Hannibal");
    expect(decoded.summary).toContain("surgical");

    const logs = await db.activityLog.findMany({
      where: { type: "cv-variant-generated", pursuitId },
    });
    expect(logs.length).toBe(1);
  });

  it("throws when pursuit has no jdMarkdown", async () => {
    await seedProfile();
    const pursuitId = await seedJobPursuit({ withJd: false });

    await expect(generateCvVariant(pursuitId)).rejects.toThrow(/jdMarkdown/);
    expect(mockedOpenaiJson).not.toHaveBeenCalled();
  });

  it("throws when profile has no cvMarkdown", async () => {
    await seedProfile({ withCv: false });
    const pursuitId = await seedJobPursuit();

    await expect(generateCvVariant(pursuitId)).rejects.toThrow(/cvMarkdown/);
    expect(mockedOpenaiJson).not.toHaveBeenCalled();
  });
});

describe("generateCoverLetter", () => {
  it("calls openaiJson, persists JSON to coverLetter, and logs cover-letter-generated", async () => {
    await seedProfile();
    const pursuitId = await seedJobPursuit();

    const coverLetter = {
      subject: "Re: Founding Backend Engineer — distributed control plane",
      body: "Dear Hiring Team,\n\nLast year I rebuilt a distributed control plane in Rust serving 1M req/s — the exact problem your JD names. I'd like 15 minutes to walk you through the architecture and how it maps to Acme's current infra challenges.\n\n— Mohit",
    };

    mockedOpenaiJson.mockResolvedValueOnce({
      data: coverLetter,
      meta: meta(),
    } as never);

    const result = await generateCoverLetter(pursuitId, { hiringManagerName: "Jane Doe" });

    expect(mockedOpenaiJson).toHaveBeenCalledTimes(1);
    const callArg = mockedOpenaiJson.mock.calls[0][0] as {
      system: string;
      user: string;
      model: string;
    };
    expect(callArg.model).toBe("gpt-5.5");
    expect(callArg.system).toContain("cover letter");
    expect(callArg.user).toContain("Acme Robotics");
    expect(callArg.user).toContain("Jane Doe");
    expect(callArg.user).toContain("distributed control plane in Rust");

    expect(result.subject).toContain("Founding Backend Engineer");
    expect(result.body).toContain("1M req/s");

    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuitId } });
    expect(reloaded.coverLetter).not.toBeNull();
    const decoded = JSON.parse(reloaded.coverLetter ?? "");
    expect(decoded.subject).toContain("Founding Backend Engineer");
    expect(decoded.body).toContain("1M req/s");

    const logs = await db.activityLog.findMany({
      where: { type: "cover-letter-generated", pursuitId },
    });
    expect(logs.length).toBe(1);
  });

  it("defaults addressee to 'Hiring Team' when no hiringManagerName given", async () => {
    await seedProfile();
    const pursuitId = await seedJobPursuit();

    mockedOpenaiJson.mockResolvedValueOnce({
      data: { subject: "Hello", body: "Body content here covers half a page." },
      meta: meta(),
    } as never);

    await generateCoverLetter(pursuitId);

    const callArg = mockedOpenaiJson.mock.calls[0][0] as { user: string };
    expect(callArg.user).toContain("Hiring Team");
  });

  it("accepts null subject (non-email channel)", async () => {
    await seedProfile();
    const pursuitId = await seedJobPursuit();

    mockedOpenaiJson.mockResolvedValueOnce({
      data: { subject: null, body: "Body content covering half a page minimum." },
      meta: meta(),
    } as never);

    const result = await generateCoverLetter(pursuitId);
    expect(result.subject).toBeNull();
    expect(result.body).toContain("half a page");
  });

  it("throws when pursuit has no jdMarkdown", async () => {
    await seedProfile();
    const pursuitId = await seedJobPursuit({ withJd: false });

    await expect(generateCoverLetter(pursuitId)).rejects.toThrow(/jdMarkdown/);
    expect(mockedOpenaiJson).not.toHaveBeenCalled();
  });

  it("throws when profile has no cvMarkdown", async () => {
    await seedProfile({ withCv: false });
    const pursuitId = await seedJobPursuit();

    await expect(generateCoverLetter(pursuitId)).rejects.toThrow(/cvMarkdown/);
    expect(mockedOpenaiJson).not.toHaveBeenCalled();
  });
});
