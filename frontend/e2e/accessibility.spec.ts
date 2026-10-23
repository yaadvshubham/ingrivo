import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setupDefaultMocks } from "./fixtures";

test.describe("Pinfo E2E Automated Accessibility & Keyboard Audit", () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultMocks(page);
  });

  const routes = [
    { name: "Home", path: "/" },
    { name: "Scan", path: "/scan" },
    { name: "Search", path: "/search" },
    { name: "Label", path: "/label" },
    { name: "Compare", path: "/compare" },
    { name: "History", path: "/history" },
    { name: "About", path: "/about" },
    { name: "Product Detail", path: "/product/bc-3017620422003" },
  ];

  for (const { name, path } of routes) {
    test(`axe audit: ${name} (${path}) has zero serious or critical accessibility violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const seriousOrCriticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical"
      );

      expect(
        seriousOrCriticalViolations,
        `Found serious/critical accessibility violations on ${path}: ${JSON.stringify(
          seriousOrCriticalViolations.map((v) => ({ id: v.id, impact: v.impact, description: v.description })),
          null,
          2
        )}`
      ).toEqual([]);
    });
  }

  test("keyboard-only navigation: skip link jumps directly to main content", async ({ page, browserName }) => {
    await page.goto("/");
    const skipLink = page.locator("a[href='#main-content']");

    if (browserName === "webkit") {
      await skipLink.focus();
    } else {
      await page.keyboard.press("Tab");
    }
    await expect(skipLink).toBeFocused();

    // Press Enter to follow skip link
    await page.keyboard.press("Enter");
    const mainContent = page.locator("#main-content");
    await expect(mainContent).toBeVisible();
  });

  test("keyboard-only navigation: barcode manual lookup works without mouse", async ({ page }) => {
    await page.goto("/scan");

    // Focus input directly using Tab
    const barcodeInput = page.locator("#barcode-input");
    await barcodeInput.focus();
    await page.keyboard.type("3017620422003");

    // Tab to submit button and press Enter
    await page.keyboard.press("Tab");
    const submitBtn = page.getByRole("button", { name: /look up product/i });
    await expect(submitBtn).toBeFocused();
    await page.keyboard.press("Enter");

    // Reaches product detail
    await page.waitForURL("**/product/bc-3017620422003");
    await expect(page.getByRole("heading", { name: "Nutella Hazelnut Spread" })).toBeVisible();
  });
});
