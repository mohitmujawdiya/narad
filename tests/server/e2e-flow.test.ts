import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/server/db";
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";

const caller = createCallerFactory(appRouter)({});

beforeAll(async () => {
  await db.profile.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
});

beforeEach(async () => {
  await db.activityLog.deleteMany();
  await db.message.deleteMany();
  await db.touchpoint.deleteMany();
  await db.contact.deleteMany();
  await db.company.deleteMany();
});

describe("E2E flow", () => {
  it("source → contact → draft → send → log reply", async () => {
    // 1. Add a company via URL drop
    const company = await caller.companies.createFromUrl({ url: "https://stripe.com" });
    expect(company.domain).toBe("stripe.com");

    // 2. Add a contact
    const contact = await caller.contacts.create({
      companyId: company.id,
      name: "Jane Doe",
      role: "PM",
      email: "jane@stripe.com",
    });

    // 3. Draft a message
    const tp = await caller.touchpoints.draft({
      contactId: contact.id,
      channel: "email",
      subject: "Hello",
      body: "Hi Jane, ...",
    });
    expect(tp.status).toBe("Drafted");

    // 4. Send via plain-log
    const result = await caller.send.dispatch({ touchpointId: tp.id, adapterId: "plain-log" });
    expect(result.kind).toBe("logged");

    const sent = await caller.touchpoints.byId({ id: tp.id });
    expect(sent.status).toBe("Sent");
    expect(sent.sentAt).not.toBeNull();

    // 5. Log a reply
    await caller.touchpoints.logReply({ id: tp.id, replySnippet: "Yes, let's chat" });
    const replied = await caller.touchpoints.byId({ id: tp.id });
    expect(replied.status).toBe("Replied");
    expect(replied.repliedAt).not.toBeNull();

    // 6. Verify activity log captured everything
    const logs = await db.activityLog.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "asc" } });
    const types = logs.map((l) => l.type);
    expect(types).toContain("contact-created");
    expect(types).toContain("touchpoint-drafted");
    expect(types).toContain("touchpoint-sent");
    expect(types).toContain("manual-reply-logged");
  });
});
