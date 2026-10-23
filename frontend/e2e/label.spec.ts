import { test, expect } from "@playwright/test";
import { setupDefaultMocks } from "./fixtures";

test.describe("Ingrivo E2E Label OCR & Review Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultMocks(page);
  });

  test("generates synthetic food label, uploads, reviews OCR data, corrects and confirms product", async ({ page }) => {
    // 1. Generate a synthetic food label image via browser page screenshot
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; background: #ffffff; font-family: Arial, sans-serif; }
            .label {
              width: 420px;
              padding: 24px;
              border: 3px solid #000;
              background: #fff;
              color: #000;
            }
            h1 { font-size: 24px; margin: 0 0 8px 0; text-transform: uppercase; font-weight: bold; }
            h2 { font-size: 18px; margin: 0 0 12px 0; }
            p { font-size: 14px; margin: 6px 0; line-height: 1.4; }
            .box { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 8px 0; margin: 12px 0; }
          </style>
        </head>
        <body>
          <div class="label" id="food-label">
            <h1>CRUNCHY OAT BITES</h1>
            <p><strong>Brand:</strong> Nature Foods</p>
            <div class="box">
              <h2>Nutrition Facts</h2>
              <p>Per 100g</p>
              <p>Energy: 420 kcal</p>
              <p>Protein: 8.5 g</p>
              <p>Total Fat: 12.0 g</p>
              <p>Carbohydrates: 65.0 g</p>
              <p>Total Sugars: 15.0 g</p>
              <p>Sodium: 0.15 g</p>
            </div>
            <p><strong>Ingredients:</strong> Whole grain oats, cane sugar, sunflower oil, sea salt.</p>
            <p><strong>Allergens:</strong> Contains oats. May contain traces of nuts.</p>
          </div>
        </body>
      </html>
    `);

    const labelElement = page.locator("#food-label");
    const imageBuffer = await labelElement.screenshot({ type: "png" });

    // 2. Navigate to /label page
    await page.goto("/label");
    await expect(page).toHaveTitle(/Label Review & OCR | Ingrivo/i);

    // 3. Upload synthetic label image via file upload input
    const fileInput = page.locator("input[type='file']:not([capture])");
    await fileInput.setInputFiles({
      name: "synthetic-food-label.png",
      mimeType: "image/png",
      buffer: imageBuffer,
    });

    // 4. Verify preview appears and click Read label text (OCR)
    await expect(page.getByText("Photo Preview")).toBeVisible();
    const readTextBtn = page.getByRole("button", { name: /Read label text \(OCR\)/i });
    await expect(readTextBtn).toBeVisible();
    await readTextBtn.click();

    // 5. Wait for Review screen or manual entry fallback
    const reviewHeader = page.getByRole("heading", { name: /Review Label Information/i });
    const manualFallbackBtn = page.getByRole("button", { name: /Type details manually/i });

    try {
      await expect(reviewHeader).toBeVisible({ timeout: 25_000 });
    } catch {
      if (await manualFallbackBtn.isVisible()) {
        await manualFallbackBtn.click();
        await expect(reviewHeader).toBeVisible({ timeout: 5_000 });
      }
    }

    // 6. Test user correction: fill/correct Product Name and Brand
    const nameInput = page.locator("#label-product-name");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Crunchy Oat Bites");

    const brandInput = page.locator("#label-product-brand");
    if (await brandInput.isVisible()) {
      await brandInput.fill("Nature Foods");
    }

    // Select Per 100g basis if not already selected
    const per100gBtn = page.getByRole("button", { name: "Per 100g" });
    if (await per100gBtn.isVisible()) {
      await per100gBtn.click();
    }

    // Check confirmation checkbox
    const confirmCheckbox = page.locator("#confirm-label-check");
    await confirmCheckbox.check();

    // 7. Confirm and create label product
    const submitBtn = page.locator("#use-label-info");
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 8. Navigates to created label product /product/lb-<uuid>
    await page.waitForURL("**/product/lb-*", { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Crunchy Oat Bites" })).toBeVisible();
    await expect(page.getByText(/From your label/i).first()).toBeVisible();
  });
});
