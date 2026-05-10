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
const DOMAIN = `mdtest-${STAMP}.test`;
const NAME = `MdTest ${STAMP}`;

test.afterAll(async () => {
  await db.pursuit.deleteMany({ where: { companyDomain: DOMAIN } });
  await db.$disconnect();
});

test("research tab renders markdown bold + lists + tables + links", async ({ page }) => {
  // Seed a pursuit with pre-populated research JSON containing markdown.
  const research = {
    overview: {
      text: `**Stripe** is a fintech infrastructure platform.

Key facts:
- Founded 2010
- HQ in San Francisco
- Series I at $95B valuation

| Field | Value |
|-------|-------|
| Stage | Pre-IPO |
| Headcount | 8000+ |
| Last funding | $6.5B in 2023 |

Visit [stripe.com](https://stripe.com) for more.`,
      citations: [{ title: "stripe.com", url: "https://stripe.com" }],
      meta: { provider: "openai", model: "gpt-5.5", latencyMs: 5000 },
    },
    hiringSignal: {
      text: "Several PM roles open as of 2026.",
      citations: [],
      meta: { provider: "openai", model: "gpt-5.5", latencyMs: 1000 },
    },
    founderContent: {
      text: "Recent founder posts about infra.",
      citations: [],
      meta: { provider: "openai", model: "gpt-5.5", latencyMs: 1000 },
    },
    refreshedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const pursuit = await db.pursuit.create({
    data: {
      type: "company",
      companyName: NAME,
      companyDomain: DOMAIN,
      status: "Researched",
      companyResearch: JSON.stringify(research),
    },
  });

  await page.goto(`/pursuits/${pursuit.id}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Research" }).click();
  await page.waitForTimeout(500);

  // Bold should render as <strong>, not as **literal**
  const boldStripe = page.locator("strong", { hasText: "Stripe" }).first();
  await expect(boldStripe).toBeVisible();

  // List items should render
  await expect(page.getByText("Founded 2010")).toBeVisible();

  // Table should render
  await expect(page.getByRole("table").first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Field" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Pre-IPO" })).toBeVisible();

  // Inline link rendered with proper href
  const link = page.getByRole("link", { name: "stripe.com", exact: true }).first();
  await expect(link).toHaveAttribute("href", "https://stripe.com");

  await page.screenshot({ path: "e2e-screenshots/markdown-render.png", fullPage: true });
});
