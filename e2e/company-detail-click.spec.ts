import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: path.resolve(__dirname, "../.env.local"), override: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const STAMP = Date.now().toString(36);
const COMPANY_NAME = `ClickTest ${STAMP}`;
const DOMAIN = `clicktest-${STAMP}.test`;

test.afterAll(async () => {
  await db.company.deleteMany({ where: { domain: DOMAIN } });
  await db.$disconnect();
});

test("clicking company name on kanban opens detail page with content", async ({ page }) => {
  // 1. Seed a company directly in DB (avoid going through GUI for test setup)
  const company = await db.company.create({
    data: { name: COMPANY_NAME, domain: DOMAIN, sector: "test", status: "Discovered" },
  });

  // 2. Navigate to /companies — should show the kanban with our company in Discovered
  await page.goto("/companies");
  await page.waitForLoadState("networkidle");

  const link = page.getByRole("link", { name: COMPANY_NAME });
  await expect(link).toBeVisible({ timeout: 15_000 });

  // 3. Click the company name link
  const linkBox = await link.boundingBox();
  if (!linkBox) throw new Error("link box missing");
  await page.mouse.click(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);

  // 4. URL should change to /companies/<id>
  await expect(page).toHaveURL(new RegExp(`/companies/${company.id}`), { timeout: 10_000 });

  // 5. The detail page should show CONTENT, not blank.
  // Topbar with company name:
  await expect(page.locator("header").getByText(COMPANY_NAME)).toBeVisible({ timeout: 15_000 });

  // The h2 with company name (in CompanyTabs):
  await expect(page.getByRole("heading", { level: 2, name: COMPANY_NAME })).toBeVisible({ timeout: 15_000 });

  // The Tabs (Overview/Research/Contacts/Outreach/Notes):
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Research" })).toBeVisible();

  await page.screenshot({ path: "e2e-screenshots/company-detail-after-click.png", fullPage: true });
});
