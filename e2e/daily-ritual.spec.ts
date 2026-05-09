import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: path.resolve(__dirname, "../.env.local"), override: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const STAMP = Date.now().toString(36);
const COMPANY_NAME = `E2eco ${STAMP}`;
const DOMAIN = `e2eco-${STAMP}.test`;
const URL_INPUT = `https://${DOMAIN}`;
const CONTACT_NAME = `E2e Tester ${STAMP}`;
const ROLE = "PM";
const EMAIL = `e2e-${STAMP}@${DOMAIN}`;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  // Cleanup: remove the company we created (cascades to contacts, touchpoints, messages, activity logs)
  await db.company.deleteMany({ where: { domain: DOMAIN } });
  await db.$disconnect();
});

test("daily ritual end-to-end through the GUI", async ({ page }) => {
  // ─── Step 1: Sidebar nav present on /
  await test.step("dashboard renders with sidebar", async () => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Narad" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Companies" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Queue" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    await page.screenshot({ path: "e2e-screenshots/01-dashboard.png", fullPage: true });
  });

  // ─── Step 2: Create company via URL drop
  await test.step("add company via URL", async () => {
    await page.getByRole("link", { name: "Companies" }).click();
    await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible();
    await page.getByRole("link", { name: /Add company/i }).click();

    await expect(page.getByRole("heading", { name: "Add company" })).toBeVisible();
    await page.getByLabel("Company URL").fill(URL_INPUT);
    await page.getByRole("button", { name: "Add company" }).click();

    // After redirect to /companies/[id] — give Next.js time to compile the route on first hit
    await expect(page).toHaveURL(/\/companies\/[a-z0-9]+/i);
    await expect(page.getByText(/E2eco/i).first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: "e2e-screenshots/02-company-detail.png", fullPage: true });
  });

  // ─── Step 3: Add a contact
  await test.step("add contact in dialog", async () => {
    await page.getByRole("tab", { name: /Contacts/i }).click();
    await page.getByRole("button", { name: /Add contact/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Inputs in order: Name (textbox), Role (textbox), Email (email), LinkedIn URL (textbox),
    // Twitter URL (textbox), Notes (textarea). Use positional locators because the inputs
    // lack id/htmlFor pairing.
    const inputs = dialog.locator("input");
    await inputs.nth(0).fill(CONTACT_NAME); // Name
    await inputs.nth(1).fill(ROLE);          // Role
    await inputs.nth(2).fill(EMAIL);         // Email
    await dialog.getByRole("button", { name: /^Add$/ }).click();

    // Dialog closes; contact appears in list
    await expect(page.getByRole("link", { name: CONTACT_NAME })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: "e2e-screenshots/03-contact-added.png", fullPage: true });
  });

  // ─── Step 4: Open contact, draft message
  await test.step("draft message via template", async () => {
    await page.getByRole("link", { name: CONTACT_NAME }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(CONTACT_NAME);

    await page.getByRole("button", { name: /Draft message/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Default channel is email; body is the only textarea in the dialog at this point.
    const bodyEditor = dialog.locator("textarea");
    await bodyEditor.fill(
      `Hi ${CONTACT_NAME.split(" ")[0]},\n\nThis is an end-to-end test message.\n\n— Test`
    );
    await dialog.getByRole("button", { name: /Save to queue/i }).click();

    // After save → redirect to /queue
    await expect(page).toHaveURL(/\/queue/);
    await page.screenshot({ path: "e2e-screenshots/04-queue-after-draft.png", fullPage: true });
  });

  // ─── Step 5: Send via plain-log from queue
  await test.step("send via plain-log adapter", async () => {
    // The queue is showing our card; trigger the dropdown to pick plain-log
    await expect(page.getByText(CONTACT_NAME)).toBeVisible();

    // Click the chevron-down to open adapter dropdown (it's the 2nd button after "Send")
    const chevronButtons = page.getByRole("button").filter({ has: page.locator("svg.lucide-chevron-down") });
    await chevronButtons.first().click();

    await page.getByRole("menuitem", { name: /Already sent \(just log\)/i }).click();

    // Wait for the toast
    await expect(page.getByText("Logged as sent")).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "e2e-screenshots/05-after-send.png", fullPage: true });
  });

  // ─── Step 6: Inbox shows the touchpoint awaiting reply
  await test.step("inbox shows awaiting reply", async () => {
    await page.getByRole("link", { name: "Inbox" }).click();
    await expect(page.getByRole("heading", { name: "Awaiting reply" })).toBeVisible();
    await expect(page.getByText(CONTACT_NAME)).toBeVisible();
    await page.screenshot({ path: "e2e-screenshots/06-inbox-awaiting.png", fullPage: true });
  });

  // ─── Step 7: Log a reply
  await test.step("log a reply via dialog", async () => {
    await page.getByRole("button", { name: /Log reply/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Reply snippet textarea (only textarea in this dialog)
    await dialog.locator("textarea").fill("Yes, let's chat next week.");
    await dialog.getByRole("button", { name: /Log as replied/i }).click();

    await expect(page.getByText("Reply logged")).toBeVisible({ timeout: 5000 });

    // Now it should appear under "Recently replied"
    await expect(page.getByRole("heading", { name: "Recently replied" })).toBeVisible();
    await page.screenshot({ path: "e2e-screenshots/07-inbox-replied.png", fullPage: true });
  });

  // ─── Step 8: Verify in DB the touchpoint is Replied
  await test.step("DB state check: touchpoint is Replied", async () => {
    const company = await db.company.findUniqueOrThrow({
      where: { domain: DOMAIN },
      include: { contacts: { include: { touchpoints: true } } },
    });
    expect(company.contacts.length).toBe(1);
    expect(company.contacts[0].touchpoints.length).toBe(1);
    expect(company.contacts[0].touchpoints[0].status).toBe("Replied");
    expect(company.contacts[0].touchpoints[0].sentAt).not.toBeNull();
    expect(company.contacts[0].touchpoints[0].repliedAt).not.toBeNull();
  });
});
