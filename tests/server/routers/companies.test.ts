import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db } from "@/server/db";
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";

const createCaller = createCallerFactory(appRouter);
const caller = createCaller({});

beforeAll(async () => {
  // ensure singleton exists for any procedures that depend on it
  await db.profile.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
});

afterEach(async () => {
  await db.activityLog.deleteMany();
  await db.company.deleteMany();
});

describe("companies router", () => {
  it("creates a company with minimal fields", async () => {
    const company = await caller.companies.create({
      name: "Acme Inc",
      domain: "acme.com",
    });
    expect(company.name).toBe("Acme Inc");
    expect(company.status).toBe("Discovered");
  });

  it("rejects duplicate domain", async () => {
    await caller.companies.create({ name: "Acme Inc", domain: "acme.com" });
    await expect(
      caller.companies.create({ name: "Acme Two", domain: "acme.com" })
    ).rejects.toThrow();
  });

  it("lists companies grouped by status", async () => {
    await caller.companies.create({ name: "A", domain: "a.com" });
    await caller.companies.create({ name: "B", domain: "b.com" });
    const list = await caller.companies.list();
    expect(list.length).toBe(2);
  });

  it("transitions status", async () => {
    const company = await caller.companies.create({ name: "X", domain: "x.com" });
    const updated = await caller.companies.setStatus({ id: company.id, status: "Targeting" });
    expect(updated.status).toBe("Targeting");
  });

  it("deletes a company and its activity logs cascade", async () => {
    const company = await caller.companies.create({ name: "Y", domain: "y.com" });
    await caller.companies.remove({ id: company.id });
    expect(await db.company.count()).toBe(0);
  });
});
