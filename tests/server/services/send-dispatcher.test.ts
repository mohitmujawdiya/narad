import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db } from "@/server/db";
import { dispatchSend } from "@/server/services/send-dispatcher";
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";

const caller = createCallerFactory(appRouter)({});

beforeAll(async () => {
  await db.profile.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
});

afterEach(async () => {
  await db.activityLog.deleteMany();
  await db.message.deleteMany();
  await db.touchpoint.deleteMany();
  await db.contact.deleteMany();
  await db.company.deleteMany();
});

describe("send dispatcher", () => {
  it("plain-log marks touchpoint as Sent immediately", async () => {
    const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
    const contact = await caller.contacts.create({ companyId: company.id, name: "Jane" });
    const tp = await caller.touchpoints.draft({ contactId: contact.id, channel: "email", body: "hi" });

    const result = await dispatchSend({ touchpointId: tp.id, adapterId: "plain-log" });
    expect(result.kind).toBe("logged");

    const after = await db.touchpoint.findUniqueOrThrow({ where: { id: tp.id } });
    expect(after.status).toBe("Sent");
    expect(after.sentAt).not.toBeNull();
  });

  it("mailto returns queued-for-manual without changing status", async () => {
    const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
    const contact = await caller.contacts.create({ companyId: company.id, name: "Jane", email: "jane@acme.com" });
    const tp = await caller.touchpoints.draft({ contactId: contact.id, channel: "email", subject: "hi", body: "hello" });

    const result = await dispatchSend({ touchpointId: tp.id, adapterId: "mailto" });
    expect(result.kind).toBe("queued-for-manual");
    if (result.kind === "queued-for-manual") {
      expect(result.mailtoUrl).toContain("mailto:jane@acme.com");
      expect(result.mailtoUrl).toContain("subject=hi");
    }

    const after = await db.touchpoint.findUniqueOrThrow({ where: { id: tp.id } });
    expect(after.status).toBe("Drafted");  // unchanged until user confirms
  });

  it("mailto fails when contact has no email", async () => {
    const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
    const contact = await caller.contacts.create({ companyId: company.id, name: "Jane" });
    const tp = await caller.touchpoints.draft({ contactId: contact.id, channel: "email", body: "x" });

    const result = await dispatchSend({ touchpointId: tp.id, adapterId: "mailto" });
    expect(result.kind).toBe("failed");
  });
});
