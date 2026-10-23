import { test, expect } from "@playwright/test";
import { setupDefaultMocks } from "./fixtures";

test.describe("Ingrivo E2E Core Flows", () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultMocks(page);
  });

  test("manual barcode lookup: complete product facts display", async ({ page }) => {
    await page.goto("/scan");
    await expect(page).toHaveTitle(/Scan Barcode | Ingrivo/i);

    // Enter valid complete barcode
    const input = page.locator("#barcode-input");
    await input.focus();
    await input.pressSequentially("3017620422003");
    await page.click("button:has-text('Look up product')");

    // Navigates to product detail
    await page.waitForURL("**/product/bc-3017620422003");
    await expect(page.getByRole("heading", { name: "Nutella Hazelnut Spread" })).toBeVisible();
    await expect(page.getByText("Ferrero")).toBeVisible();
    await expect(page.getByText("Energy")).toBeVisible();
    await expect(page.getByText("539 kcal")).toBeVisible();
  });

  test("manual barcode lookup: partial product with missing chips", async ({ page }) => {
    await page.goto("/scan");
    const input = page.locator("#barcode-input");
    await input.focus();
    await input.pressSequentially("8901719114700");
    await page.click("button:has-text('Look up product')");

    await page.waitForURL("**/product/bc-8901719114700");
    await expect(page.getByRole("heading", { name: "Local Namkeen Mixture" })).toBeVisible();
    // Missing chips should be visible for unlisted nutrition values
    await expect(page.locator("[data-testid='missing-chip']").first()).toBeVisible();
  });

  test("manual barcode lookup: not found shows friendly error and fallback actions", async ({ page }) => {
    await page.goto("/scan");
    const input = page.locator("#barcode-input");
    await input.focus();
    await input.pressSequentially("0000000000000");
    await page.click("button:has-text('Look up product')");

    await page.waitForURL("**/product/bc-0000000000000");
    await expect(page.getByText(/Product Not Found/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /search product by title/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /capture label photo/i })).toBeVisible();
  });

  test("search: submit-only behavior and rate-limited state", async ({ page }) => {
    await page.goto("/search");
    const searchInput = page.locator("#search-query-input");

    // Typing alone does not trigger search
    await searchInput.fill("nut");
    await page.waitForTimeout(300);
    await expect(page.locator("[data-testid='initial-hint']")).toBeVisible();

    // Empty query validation
    await searchInput.fill("a");
    await page.click("[data-testid='search-submit-btn']");
    await expect(page.locator("[data-testid='search-validation-error']")).toBeVisible();

    // Valid search query
    await searchInput.fill("nutella");
    await page.click("[data-testid='search-submit-btn']");
    await page.waitForURL("**/search?q=nutella&page=1");
    await expect(page.getByText("Nutella Hazelnut Spread")).toBeVisible();

    // Mock rate limit
    await page.route("**/api/v1/products/search*", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "RATE_LIMITED",
            message: "Too many search requests. Please slow down.",
            request_id: "mock-rate-limit-id",
          },
        }),
      });
    });

    await searchInput.fill("too-fast-query");
    await page.click("[data-testid='search-submit-btn']");
    await expect(page.getByText(/Search limit reached/i)).toBeVisible();
  });

  test("product comparison: side-by-side math and incomparable beverage vs solid", async ({ page }) => {
    // Mock compare route
    await page.route("**/api/v1/compare", async (route) => {
      const postData = route.request().postData() || "";
      if (postData.includes("5449000000996")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            a: {
              ref: "bc-3017620422003",
              name: "Nutella Hazelnut Spread",
              brand: "Ferrero",
              basis: "per_100g",
              completeness: { score: 1.0, missing: [] },
            },
            b: {
              ref: "bc-5449000000996",
              name: "Coca-Cola Original",
              brand: "Coca-Cola",
              basis: "per_100ml",
              completeness: { score: 0.95, missing: [] },
            },
            nutrient_rows: [
              {
                nutrient: "energy_kcal",
                label: "Energy (kcal)",
                unit: "kcal",
                val_a: 539,
                provenance_a: "source",
                basis_a: "per_100g",
                val_b: 42,
                provenance_b: "source",
                basis_b: "per_100ml",
                comparable: false,
                incomparable_reason: "Different basis units (grams vs milliliters) cannot be compared directly.",
                direction: "incomparable",
              },
            ],
            ingredients_diff: {
              shared: ["sugar"],
              only_a: ["hazelnuts"],
              only_b: ["caramel colour"],
              is_approximate: true,
              disclaimer: "Parsed approximately.",
            },
            allergens_diff: {
              shared: [],
              only_a: ["Milk", "Nuts"],
              only_b: [],
              note_a: "",
              note_b: "",
            },
            ai: null,
            ai_status: "omitted",
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            a: {
              ref: "bc-3017620422003",
              name: "Nutella Hazelnut Spread",
              brand: "Ferrero",
              basis: "per_100g",
              completeness: { score: 1.0, missing: [] },
            },
            b: {
              ref: "bc-3017620422003",
              name: "Nutella Hazelnut Spread",
              brand: "Ferrero",
              basis: "per_100g",
              completeness: { score: 1.0, missing: [] },
            },
            nutrient_rows: [
              {
                nutrient: "energy_kcal",
                label: "Energy (kcal)",
                unit: "kcal",
                val_a: 539,
                provenance_a: "source",
                basis_a: "per_100g",
                val_b: 539,
                provenance_b: "source",
                basis_b: "per_100g",
                comparable: true,
                diff_absolute: 0,
                diff_relative_percent: 0,
                direction: "same",
              },
            ],
            ingredients_diff: {
              shared: ["sugar"],
              only_a: [],
              only_b: [],
              is_approximate: true,
              disclaimer: "Parsed approximately.",
            },
            allergens_diff: {
              shared: ["Milk"],
              only_a: [],
              only_b: [],
              note_a: "",
              note_b: "",
            },
            ai: null,
            ai_status: "omitted",
          }),
        });
      }
    });

    await page.goto("/compare?a=bc-3017620422003&b=bc-5449000000996");
    await expect(page.locator("text=Incomparable:").and(page.locator(":visible")).first()).toBeVisible();
    await expect(page.locator("text=Different basis units").and(page.locator(":visible")).first()).toBeVisible();
  });

  test("history: save on view, reopen snapshot, remove with undo, clear all", async ({ page }) => {
    // 1. Visit product to save it into history
    await page.goto("/product/bc-3017620422003");
    await expect(page.getByRole("heading", { name: "Nutella Hazelnut Spread" })).toBeVisible();

    // 2. Open /history
    await page.goto("/history");
    await expect(page).toHaveTitle(/Scan History | Ingrivo/i);
    await expect(page.getByText("Nutella Hazelnut Spread")).toBeVisible();

    // 3. Reopen from history
    await page.click("a:has-text('Nutella Hazelnut Spread')");
    await page.waitForURL("**/product/bc-3017620422003");
    await expect(page.getByText(/Viewing saved snapshot/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /refresh from source/i })).toBeVisible();

    // 4. Return to history and test removal with undo
    await page.goto("/history");
    await page.click("button[aria-label='Remove Nutella Hazelnut Spread from history']");
    await expect(page.getByText("Removed:")).toBeVisible();
    // Click Undo
    await page.click("button:has-text('Undo')");
    await expect(page.getByText("Nutella Hazelnut Spread")).toBeVisible();

    // 5. Clear all history with confirmation
    await page.click("button:has-text('Clear all')");
    await expect(page.getByText("Clear All History?")).toBeVisible();
    await page.click("button:has-text('Yes, clear everything')");
    await expect(page.getByText("No Scan History Yet")).toBeVisible();
  });

  test("AI explanation: success, unavailable degradation, invalid output degradation", async ({ page }) => {
    await page.goto("/product/bc-3017620422003");
    const explainBtn = page.getByRole("button", { name: /explain this product/i });
    await expect(explainBtn).toBeVisible();

    // 1. Success case
    await explainBtn.click();
    await expect(page.getByText("Nutella is a rich cocoa and hazelnut spread")).toBeVisible();
    // Facts remain visible
    await expect(page.getByText("539 kcal")).toBeVisible();

    // 2. AI Unavailable case
    await page.route("**/api/v1/analysis/explain", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "AI_UNAVAILABLE",
            message: "Gemini API is temporarily unavailable. Facts remain visible.",
            request_id: "mock-ai-unavailable-id",
          },
        }),
      });
    });

    await page.goto("/product/bc-8901719114700");
    const explainBtn2 = page.getByRole("button", { name: /explain this product/i });
    await explainBtn2.click();
    await expect(page.getByText(/AI explanation temporarily unavailable/i)).toBeVisible();
    // Product facts must remain intact
    await expect(page.getByRole("heading", { name: "Local Namkeen Mixture" })).toBeVisible();

    // 3. AI Invalid Output case
    await page.route("**/api/v1/analysis/explain", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "AI_INVALID_OUTPUT",
            message: "Model response failed structural schema verification.",
            request_id: "mock-ai-invalid-id",
          },
        }),
      });
    });

    await page.goto("/product/bc-5449000000996");
    const explainBtn3 = page.getByRole("button", { name: /explain this product/i });
    await explainBtn3.click();
    await expect(page.getByText(/Explanation verification failed/i)).toBeVisible();
    await expect(page.getByText("42 kcal")).toBeVisible();
  });

  test("camera permissions: denied and unsupported device handling", async ({ page, context }) => {
    // 1. Permission denied
    await context.clearPermissions();
    await page.goto("/scan");
    const startCameraBtn = page.getByRole("button", { name: /start camera/i });
    if (await startCameraBtn.isVisible()) {
      await startCameraBtn.click();
      // Should show denied or fallback state
      await expect(page.getByText(/permission|camera|manual/i).first()).toBeVisible();
    }

    // 2. Unsupported camera: override navigator.mediaDevices
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        value: undefined,
        configurable: true,
      });
    });

    await page.goto("/scan");
    await expect(page.getByText(/manual barcode entry|camera not supported|unsupported/i).first()).toBeVisible();
  });

  test("slow backend waking up notification and invalid response Zod rejection", async ({ page }) => {
    // Slow search response triggers waking up message
    await page.route("**/api/v1/products/search*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          query: "slow",
          page: 1,
          page_size: 12,
          total: 0,
          page_count: 0,
          results: [],
        }),
      });
    });

    await page.goto("/search");
    const input = page.locator("#search-query-input");
    await input.focus();
    await input.pressSequentially("slow");
    await page.click("[data-testid='search-submit-btn']");
    await expect(page.getByText(/waking up the server/i)).toBeVisible({ timeout: 10_000 });

    // Invalid response payload rejected by Zod
    await page.route("**/api/v1/products/barcode/3017620422003", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          corrupt_field: 12345,
          ref: null, // violates schema
        }),
      });
    });

    await page.goto("/product/bc-3017620422003");
    await expect(page.getByText(/Error|Failed to parse|Invalid response/i).first()).toBeVisible();
  });
});
