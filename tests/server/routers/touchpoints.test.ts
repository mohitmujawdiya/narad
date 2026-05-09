import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db } from "@/server/db";
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";

const createCaller = createCallerFactory(appRouter);
const caller = createCaller({});

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

async function setup() {
  const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
  const contact = await caller.contacts.create({
    companyId: company.id,
    name: "Jane Doe",
    email: "jane@acme.com",
  });
  return { company, contact };
}

describe("touchpoints router", () => {
  it("creates a touchpoint with a draft message", async () => {
    const { contact } = await setup();
    const tp = await caller.touchpoints.draft({
      contactId: contact.id,
      channel: "email",
      subject: "Hello",
      body: "Hi Jane,\n\nNice to meet you.\n\n— Mohit",
    });
    expect(tp.status).toBe("Drafted");
    expect(tp.message).toBeTruthy();
    expect(tp.message?.body).toContain("Nice to meet you");
  });

  it("queues a draft", async () => {
    const { contact } = await setup();
    const tp = await caller.touchpoints.draft({ contactId: contact.id, channel: "email", body: "x" });
    const queued = await caller.touchpoints.queue({ id: tp.id });
    expect(queued.status).toBe("Queued");
  });

  it("lists drafts and queued in queue", async () => {
    const { contact } = await setup();
    await caller.touchpoints.draft({ contactId: contact.id, channel: "email", body: "draft" });
    const tp2 = await caller.touchpoints.draft({ contactId: contact.id, channel: "email", body: "queued" });
    await caller.touchpoints.queue({ id: tp2.id });
    const queue = await caller.touchpoints.listQueue();
    expect(queue.length).toBe(2);
  });
});
