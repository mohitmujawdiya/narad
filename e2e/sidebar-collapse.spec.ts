import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("sidebar collapses and expands; kanban scroll is contained", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));

  // 1. Visit /pursuits (has kanban with potentially wide content)
  await page.goto("/pursuits");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  // 2. Sidebar starts expanded (~224px = w-56)
  const aside = page.locator("aside");
  const expandedBox = await aside.boundingBox();
  expect(expandedBox?.width).toBeGreaterThan(200);
  await page.screenshot({ path: "e2e-screenshots/sidebar-expanded.png", fullPage: true });

  // 3. Document does NOT scroll horizontally even with wide kanban
  const docScrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(docScrollWidth).toBe(0);

  // 4. Click collapse toggle
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await page.waitForTimeout(400);

  // 5. Sidebar is now narrow (~56px = w-14)
  const collapsedBox = await aside.boundingBox();
  expect(collapsedBox?.width).toBeLessThan(80);
  expect(collapsedBox?.width).toBeGreaterThan(40);
  await page.screenshot({ path: "e2e-screenshots/sidebar-collapsed.png", fullPage: true });

  // 6. Reload — collapsed state persists via localStorage
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const persistedBox = await page.locator("aside").boundingBox();
  expect(persistedBox?.width).toBeLessThan(80);

  // 7. Click expand toggle
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await page.waitForTimeout(400);
  const reExpandedBox = await page.locator("aside").boundingBox();
  expect(reExpandedBox?.width).toBeGreaterThan(200);
});
