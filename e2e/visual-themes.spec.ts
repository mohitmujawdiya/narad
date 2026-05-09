import { test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const ROUTES = [
  { path: "/", name: "dashboard" },
  { path: "/companies", name: "companies-kanban" },
  { path: "/companies/new", name: "add-company" },
  { path: "/queue", name: "queue" },
  { path: "/inbox", name: "inbox" },
  { path: "/settings", name: "settings" },
];

for (const mode of ["light", "dark"] as const) {
  test(`screenshots: ${mode} mode`, async ({ page }) => {
    // Set theme via localStorage before page load (next-themes reads from there)
    await page.addInitScript((m) => {
      localStorage.setItem("theme", m);
    }, mode);

    for (const route of ROUTES) {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");
      // small grace period for any in-flight queries to settle
      await page.waitForTimeout(800);
      await page.screenshot({
        path: `e2e-screenshots/theme-${mode}-${route.name}.png`,
        fullPage: true,
      });
    }
  });
}
