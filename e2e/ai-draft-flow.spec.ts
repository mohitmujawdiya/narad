import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: path.resolve(__dirname, "../.env.local"), override: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const STAMP = Date.now().toString(36);
const COMPANY_NAME = `AiTest ${STAMP}`;
const DOMAIN = `aitest-${STAMP}.test`;
const CONTACT_NAME = `Test Person ${STAMP}`;

test.afterAll(async () => {
  await db.company.deleteMany({ where: { domain: DOMAIN } });
  await db.$disconnect();
});

test("AI draft generates a queued touchpoint with non-null confidence", async ({ page }) => {
  // Seed: company + contact (skip going through GUI; that's covered by daily-ritual.spec.ts)
  const company = await db.company.create({
    data: { name: COMPANY_NAME, domain: DOMAIN, sector: "test", status: "Targeting" },
  });
  const contact = await db.contact.create({
    data: { companyId: company.id, name: CONTACT_NAME, role: "PM", email: `test@${DOMAIN}` },
  });

  // Open the contact page
  await page.goto(`/contacts/${contact.id}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: CONTACT_NAME })).toBeVisible({ timeout: 15_000 });

  // Click "AI draft"
  await page.getByRole("button", { name: /AI draft/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Switch channel to LinkedIn (native <select>)
  await dialog.locator("select").selectOption("linkedin");

  // Wait for templates to load, then pick linkedin-peer via the Radix Select trigger
  const templateTrigger = dialog.locator('[role="combobox"]').first();
  await expect(templateTrigger).toBeVisible({ timeout: 5_000 });
  await templateTrigger.click();

  // The Radix dropdown renders options in a portal — look for the option in the full page
  await page.getByRole("option", { name: /linkedin-peer/i }).click();

  // Generate
  await dialog.getByRole("button", { name: /Generate draft/i }).click();

  // Wait up to 60s for the AI to draft + redirect to /queue
  await expect(page).toHaveURL(/\/queue/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");

  // Verify the touchpoint exists in DB with a confidence score
  const tp = await db.touchpoint.findFirstOrThrow({
    where: { contactId: contact.id },
    include: { message: true },
  });
  expect(tp.status).toBe("Drafted");
  expect(tp.message?.body.length ?? 0).toBeGreaterThan(20); // some real content
  expect(tp.message?.draftConfidence).not.toBeNull();
  expect(tp.message?.draftedBy).toContain("gpt-5"); // model id should be one of the gpt-5 family

  await page.screenshot({ path: "e2e-screenshots/ai-draft-success.png", fullPage: true });
});
