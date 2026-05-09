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
  await db.contact.deleteMany();
  await db.company.deleteMany();
});

describe("contacts router", () => {
  it("creates a contact under a company", async () => {
    const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
    const contact = await caller.contacts.create({
      companyId: company.id,
      name: "Jane Doe",
      role: "PM",
      email: "jane@acme.com",
    });
    expect(contact.name).toBe("Jane Doe");
    expect(contact.companyId).toBe(company.id);
  });

  it("lists contacts for a company", async () => {
    const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
    await caller.contacts.create({ companyId: company.id, name: "A" });
    await caller.contacts.create({ companyId: company.id, name: "B" });
    const list = await caller.contacts.listForCompany({ companyId: company.id });
    expect(list.length).toBe(2);
  });

  it("removes a contact", async () => {
    const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
    const contact = await caller.contacts.create({ companyId: company.id, name: "X" });
    await caller.contacts.remove({ id: contact.id });
    expect(await db.contact.count()).toBe(0);
  });
});
