import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

config({ path: path.resolve(__dirname, "../.env.local"), override: true });

const url = process.env.DATABASE_URL ?? "file:./narad.db";
const filePath = url.replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({ url: filePath });
const db = new PrismaClient({ adapter });

const STAMP = Date.now().toString(36);
const COMPANY_NAME = `AiTest ${STAMP}`;
const DOMAIN = `aitest-${STAMP}.test`;
const CONTACT_NAME = `Test Person ${STAMP}`;

test.afterAll(async () => {
  await db.pursuit.deleteMany({ where: { companyDomain: DOMAIN } });
  await db.$disconnect();
});

test.beforeAll(({}, testInfo) => {
  if (!process.env.OPENAI_API_KEY) {
    testInfo.skip(true, "OPENAI_API_KEY not set — AI draft test skipped");
  }
});

test("AI draft generates an outreach body with confidence on the Pursuit", async ({ page }) => {
  // Seed a pursuit with pre-populated research + contact so the model has
  // grounding without us having to call the research pipeline first.
  const research = {
    overview: {
      text: `${COMPANY_NAME} is a fintech infra startup focused on payments orchestration.`,
      citations: [{ title: "About page", url: `https://${DOMAIN}/about` }],
      meta: { provider: "openai", model: "gpt-5.5", latencyMs: 1000 },
    },
    hiringSignal: {
      text: "Posted a founding-engineer role 2 weeks ago.",
      citations: [{ title: "Careers", url: `https://${DOMAIN}/careers` }],
      meta: { provider: "openai", model: "gpt-5.5", latencyMs: 1000 },
    },
    founderContent: {
      text: `${CONTACT_NAME} recently wrote about building reliability into payment retries.`,
      citations: [{ title: "Blog", url: `https://${DOMAIN}/blog/retries` }],
      meta: { provider: "openai", model: "gpt-5.5", latencyMs: 1000 },
    },
    refreshedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const pursuit = await db.pursuit.create({
    data: {
      type: "company",
      companyName: COMPANY_NAME,
      companyDomain: DOMAIN,
      status: "Targeting",
      contactName: CONTACT_NAME,
      contactRole: "Founding Engineer",
      contactEmail: `test@${DOMAIN}`,
      companyResearch: JSON.stringify(research),
    },
  });

  // Open the pursuit detail page → Outreach tab
  await page.goto(`/pursuits/${pursuit.id}`);
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { level: 2, name: COMPANY_NAME }),
  ).toBeVisible({ timeout: 15_000 });

  await page.getByRole("tab", { name: /Outreach/i }).click();

  // No draft yet — click "Draft outreach" button to open the AI dialog
  await page.getByRole("button", { name: /Draft outreach/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Draft outreach with AI/i)).toBeVisible();

  // Optional goal field
  await dialog.getByLabel(/Goal/i).fill("informational chat about their reliability work");

  // Click "Draft" — the dialog closes on success.
  await dialog.getByRole("button", { name: /^Draft$/ }).click();

  // Wait up to 60s for AI to finish + dialog to close + body to appear.
  await expect(dialog).not.toBeVisible({ timeout: 60_000 });

  // Outreach card now shows the body in a <pre> + a confidence badge
  await expect(page.getByText(/Outreach draft/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Confidence:\s*\d+\/100/i)).toBeVisible();

  // Verify the DB row got the body + meta written
  const updated = await db.pursuit.findUniqueOrThrow({ where: { id: pursuit.id } });
  expect((updated.outreachBody ?? "").length).toBeGreaterThan(20);
  expect(updated.outreachConfidence).not.toBeNull();
  expect(updated.outreachChannel).toBe("email");

  await page.screenshot({ path: "e2e-screenshots/ai-draft-success.png", fullPage: true });
});
