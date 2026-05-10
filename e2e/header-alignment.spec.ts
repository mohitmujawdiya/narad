import { test, expect } from "@playwright/test";

test("sidebar header and topbar headers form a continuous horizontal line", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto("/pursuits");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  const sidebarHeader = page.locator("aside > div").first();
  const topbar = page.locator("main header").first();

  const sidebarBox = await sidebarHeader.boundingBox();
  const topbarBox = await topbar.boundingBox();

  if (!sidebarBox || !topbarBox) throw new Error("Header boxes missing");

  // bottom edges should be within 1px (rounding tolerance)
  const sidebarBottom = sidebarBox.y + sidebarBox.height;
  const topbarBottom = topbarBox.y + topbarBox.height;
  expect(Math.abs(sidebarBottom - topbarBottom)).toBeLessThanOrEqual(1);

  // top edges too
  expect(Math.abs(sidebarBox.y - topbarBox.y)).toBeLessThanOrEqual(1);

  await page.screenshot({ path: "e2e-screenshots/header-alignment.png", clip: {
    x: 0, y: 0, width: 800, height: 80,
  }});
});
