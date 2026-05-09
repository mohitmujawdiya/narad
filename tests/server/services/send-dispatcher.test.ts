import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import {
  dispatchSend,
  confirmManualSend,
} from "@/server/services/send-dispatcher";
import type { AdapterId } from "@/server/services/send-adapters";

async function clean(): Promise<void> {
  await db.activityLog.deleteMany({});
  await db.researchCache.deleteMany({});
  await db.pursuit.deleteMany({});
  await db.profile.deleteMany({});
}

beforeEach(async () => {
  await clean();
});

afterEach(async () => {
  await clean();
});

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

describe("dispatchSend", () => {
  it("mailto adapter returns queued-for-manual with mailtoUrl", async () => {
    await seedProfile();
    const pursuit = await db.pursuit.create({
      data: {
        type: "company",
        companyName: "Acme",
        contactEmail: "jane@acme.example",
        outreachSubject: "Quick thought",
        outreachBody: "Hi Jane,\n\nQuick thought.\n\n— Mohit",
        outreachChannel: "email",
      },
    });

    const result = await dispatchSend({ pursuitId: pursuit.id, adapterId: "mailto" });
    expect(result.kind).toBe("queued-for-manual");
    if (result.kind !== "queued-for-manual") return;
    expect(result.mailtoUrl).toBeDefined();
    expect(result.mailtoUrl!).toContain("mailto:jane@acme.example");
    expect(result.mailtoUrl!).toContain(`subject=${encodeURIComponent("Quick thought")}`);
    expect(result.mailtoUrl!).toContain(encodeURIComponent("Hi Jane"));
    expect(result.instructions).toMatch(/mail client/i);

    // No DB write on queued-for-manual
    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
    expect(reloaded.outreachSentAt).toBeNull();
    const logs = await db.activityLog.findMany({ where: { pursuitId: pursuit.id } });
    expect(logs.length).toBe(0);
  });

  it("mailto adapter returns failed when contactEmail is missing", async () => {
    await seedProfile();
    const pursuit = await db.pursuit.create({
      data: {
        type: "company",
        companyName: "Acme",
        outreachSubject: "Hi",
        outreachBody: "Body here",
        outreachChannel: "email",
      },
    });

    const result = await dispatchSend({ pursuitId: pursuit.id, adapterId: "mailto" });
    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.error).toMatch(/contactEmail|email/i);
  });

  it("clipboard adapter for email returns queued-for-manual with copyToClipboard", async () => {
    await seedProfile();
    const pursuit = await db.pursuit.create({
      data: {
        type: "company",
        companyName: "Acme",
        contactEmail: "jane@acme.example",
        outreachSubject: "Quick thought",
        outreachBody: "Hi Jane,\n\nQuick thought.",
        outreachChannel: "email",
      },
    });

    const result = await dispatchSend({ pursuitId: pursuit.id, adapterId: "clipboard" });
    expect(result.kind).toBe("queued-for-manual");
    if (result.kind !== "queued-for-manual") return;
    expect(result.copyToClipboard).toBeDefined();
    expect(result.copyToClipboard!).toContain("Subject: Quick thought");
    expect(result.copyToClipboard!).toContain("Body:");
    expect(result.copyToClipboard!).toContain("Hi Jane");
    expect(result.copyToClipboard!).toContain("To: jane@acme.example");

    // No DB writes
    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
    expect(reloaded.outreachSentAt).toBeNull();
    const logs = await db.activityLog.findMany({ where: { pursuitId: pursuit.id } });
    expect(logs.length).toBe(0);
  });

  it("clipboard adapter for linkedin includes openUrl when contactLinkedinUrl present", async () => {
    await seedProfile();
    const pursuit = await db.pursuit.create({
      data: {
        type: "company",
        companyName: "Acme",
        contactLinkedinUrl: "https://linkedin.com/in/jane",
        outreachBody: "Hi Jane,\n\nQuick thought.",
        outreachChannel: "linkedin",
      },
    });

    const result = await dispatchSend({ pursuitId: pursuit.id, adapterId: "clipboard" });
    expect(result.kind).toBe("queued-for-manual");
    if (result.kind !== "queued-for-manual") return;
    expect(result.copyToClipboard).toContain("Hi Jane");
    expect(result.openUrl).toBe("https://linkedin.com/in/jane");
  });

  it("plain-log adapter returns logged, updates outreachSentAt and fires activity log", async () => {
    await seedProfile();
    const pursuit = await db.pursuit.create({
      data: {
        type: "company",
        companyName: "Acme",
        outreachSubject: "Hi",
        outreachBody: "Body content",
        outreachChannel: "email",
      },
    });

    const before = Date.now();
    const result = await dispatchSend({ pursuitId: pursuit.id, adapterId: "plain-log" });
    const after = Date.now();

    expect(result.kind).toBe("logged");
    if (result.kind !== "logged") return;
    expect(result.sentAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.sentAt.getTime()).toBeLessThanOrEqual(after);

    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
    expect(reloaded.outreachSentAt).not.toBeNull();
    expect(reloaded.outreachSentAt!.getTime()).toBe(result.sentAt.getTime());

    const logs = await db.activityLog.findMany({
      where: { type: "outreach-sent", pursuitId: pursuit.id },
    });
    expect(logs.length).toBe(1);
    const payload = logs[0].payload ? JSON.parse(logs[0].payload) : null;
    expect(payload).toEqual({ adapterId: "plain-log" });
  });

  it("returns failed when pursuit has no outreachBody", async () => {
    await seedProfile();
    const pursuit = await db.pursuit.create({
      data: {
        type: "company",
        companyName: "Acme",
      },
    });

    const result = await dispatchSend({ pursuitId: pursuit.id, adapterId: "plain-log" });
    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.error).toMatch(/outreach/i);

    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
    expect(reloaded.outreachSentAt).toBeNull();
    const logs = await db.activityLog.findMany({ where: { pursuitId: pursuit.id } });
    expect(logs.length).toBe(0);
  });

  it("returns failed when adapterId is unknown", async () => {
    await seedProfile();
    const pursuit = await db.pursuit.create({
      data: {
        type: "company",
        companyName: "Acme",
        outreachBody: "Body",
        outreachChannel: "email",
      },
    });

    const result = await dispatchSend({
      pursuitId: pursuit.id,
      adapterId: "no-such-adapter" as AdapterId,
    });
    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.error).toMatch(/unknown adapter/i);

    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
    expect(reloaded.outreachSentAt).toBeNull();
  });
});

describe("confirmManualSend", () => {
  it("updates outreachSentAt and fires manual activity log", async () => {
    await seedProfile();
    const pursuit = await db.pursuit.create({
      data: {
        type: "company",
        companyName: "Acme",
        outreachBody: "Body",
        outreachChannel: "email",
      },
    });

    const before = Date.now();
    await confirmManualSend(pursuit.id);
    const after = Date.now();

    const reloaded = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
    expect(reloaded.outreachSentAt).not.toBeNull();
    expect(reloaded.outreachSentAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(reloaded.outreachSentAt!.getTime()).toBeLessThanOrEqual(after);

    const logs = await db.activityLog.findMany({
      where: { type: "outreach-sent", pursuitId: pursuit.id },
    });
    expect(logs.length).toBe(1);
    const payload = logs[0].payload ? JSON.parse(logs[0].payload) : null;
    expect(payload).toEqual({ manual: true });
  });
});
