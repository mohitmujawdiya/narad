import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: path.resolve(__dirname, "../.env.local"), override: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const STAMP = Date.now().toString(36);
const DOMAIN = `mdtest-${STAMP}.test`;
const NAME = `MdTest ${STAMP}`;

test.afterAll(async () => {
  await db.company.deleteMany({ where: { domain: DOMAIN } });
  await db.$disconnect();
});

test("research tab renders markdown bold + lists + tables", async ({ page }) => {
  // Seed a company with pre-populated CompanyResearch containing markdown
  const company = await db.company.create({
    data: { name: NAME, domain: DOMAIN, status: "Researched" },
  });

  await db.companyResearch.create({
    data: {
      companyId: company.id,
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
      hiringSignal: { text: "Several PM roles open as of 2026.", citations: [], meta: {} },
      founderContent: { text: "Recent founder posts about infra.", citations: [], meta: {} },
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await page.goto(`/companies/${company.id}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Research" }).click();
  await page.waitForTimeout(800);

  // Bold should render as <strong>, not as **literal**
  const boldStripe = page.locator("strong", { hasText: "Stripe" }).first();
  await expect(boldStripe).toBeVisible();

  // List items should render
  await expect(page.getByText("Founded 2010")).toBeVisible();

  // Table should render
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Field" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Pre-IPO" })).toBeVisible();

  // Link should render
  const link = page.getByRole("link", { name: "stripe.com", exact: true }).first();
  await expect(link).toHaveAttribute("href", "https://stripe.com");

  await page.screenshot({ path: "e2e-screenshots/markdown-render.png", fullPage: true });
});
