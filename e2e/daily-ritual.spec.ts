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

// We import https://anthropic.com via the single-url parser. deriveNameFromHost
// turns "anthropic.com" into "Anthropic" — so we identify our test rows by that
// exact companyDomain to keep cleanup tight.
const TEST_DOMAIN = "anthropic.com";
const TEST_URL = "https://anthropic.com";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await db.pursuit.deleteMany({ where: { companyDomain: TEST_DOMAIN } });
});

test.afterAll(async () => {
  await db.pursuit.deleteMany({ where: { companyDomain: TEST_DOMAIN } });
  await db.$disconnect();
});

test("daily ritual: paste URL → kanban → detail tabs", async ({ page }) => {
  // ─── Step 1: Sidebar nav present on /
  await test.step("dashboard renders with redesign-v2 sidebar", async () => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pursuits" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Queue" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Inbox" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    await page.screenshot({ path: "e2e-screenshots/01-dashboard.png", fullPage: true });
  });

  // ─── Step 2: Create a pursuit by pasting a URL
  await test.step("import pursuit via paste field", async () => {
    await page.goto("/pursuits/new");
    await expect(page.getByRole("heading", { name: "Add pursuit" })).toBeVisible();

    await page.getByLabel("Paste source").fill(TEST_URL);
    // Wait for format detection to fire (debounced 300ms)
    await expect(page.getByText(/Single company URL/i)).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: "Import" }).click();

    // Import summary card appears with "Inserted: 1"
    await expect(page.getByText(/Inserted:\s*1/i)).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: "e2e-screenshots/02-pursuit-imported.png", fullPage: true });
  });

  // ─── Step 3: New pursuit shows up on the kanban
  await test.step("kanban shows the new pursuit in Saved column", async () => {
    await page.goto("/pursuits");
    await page.waitForLoadState("networkidle");

    // Card is a link to /pursuits/[id]; companyName is "Anthropic"
    const card = page.getByRole("link", { name: /^anthropic$/i }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: "e2e-screenshots/03-kanban.png", fullPage: true });

    await card.click();
  });

  // ─── Step 4: Pursuit detail page renders Overview by default
  await test.step("pursuit detail renders header + tabs", async () => {
    await expect(page).toHaveURL(/\/pursuits\/[a-z0-9]+/i);

    // Header heading is companyName at h2 level
    await expect(
      page.getByRole("heading", { level: 2, name: /^anthropic$/i }),
    ).toBeVisible();

    // Default tab is Overview; tab list is present
    await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Research" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Outreach" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Notes" })).toBeVisible();

    // Switching to Notes shouldn't crash and should show the textarea
    await page.getByRole("tab", { name: "Notes" }).click();
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: "e2e-screenshots/04-pursuit-detail.png", fullPage: true });
  });

  // ─── Step 5: DB-side check — exactly one pursuit was created
  await test.step("DB state: pursuit row exists with status Saved", async () => {
    const rows = await db.pursuit.findMany({ where: { companyDomain: TEST_DOMAIN } });
    expect(rows.length).toBe(1);
    expect(rows[0].companyName).toBe("Anthropic");
    expect(rows[0].status).toBe("Saved");
    expect(rows[0].type).toBe("company");
  });
});
