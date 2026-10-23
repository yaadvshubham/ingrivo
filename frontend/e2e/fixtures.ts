/**
 * Playwright E2E Fixtures & Mock Helpers (Phase 10).
 *
 * NOTE: Network mocking is strictly used ONLY within automated E2E tests via Playwright
 * page.route interception. The production application NEVER contacts mock services.
 * All mocked payloads are structured from real recorded API fixtures.
 */

import { Page } from "@playwright/test";

export const MOCK_COMPLETE_PRODUCT = {
  ref: "bc-3017620422003",
  kind: "food",
  name: "Nutella Hazelnut Spread",
  name_provenance: "source",
  brand: "Ferrero",
  brand_provenance: "source",
  quantity: "400 g",
  quantity_provenance: "source",
  image_url: "https://images.openfoodfacts.net/images/products/301/762/042/2003/front_en.883.400.jpg",
  image_provenance: "source",
  categories: ["Breakfasts", "Spreads", "Sweet spreads"],
  categories_provenance: "source",
  ingredients: {
    raw_text: "Sugar, palm oil, hazelnuts (13%), skimmed milk powder (8.7%), fat-reduced cocoa (7.4%), emulsifier: lecithins (soya), vanillin.",
    items: ["sugar", "palm oil", "hazelnuts", "skimmed milk powder", "fat-reduced cocoa", "emulsifier: lecithins", "vanillin"],
    language: "en",
    provenance: "source",
  },
  nutrition: {
    basis: "per_100g",
    serving_size: "15g",
    values: {
      energy_kcal: 539,
      energy_kj: 2252,
      sugars: 56.3,
      added_sugars: null,
      protein: 6.3,
      fat: 30.9,
      saturated_fat: 10.6,
      carbohydrates: 57.5,
      fibre: 3.4,
      sodium: 0.043,
      salt: 0.107,
    },
    provenance: "source",
  },
  allergens: {
    declared: ["Milk", "Nuts", "Soybeans"],
    traces: [],
    provenance: "source",
  },
  source: {
    name: "Open Food Facts",
    api_version: "v3",
    product_url: "https://world.openfoodfacts.org/product/3017620422003",
    last_modified: "2026-01-01T00:00:00Z",
    retrieved_at: "2026-10-12T00:00:00Z",
    license: "ODbL",
  },
  completeness: {
    score: 0.92,
    missing: [],
  },
  source_computed: {
    nutriscore: "e",
    nova_group: 4,
    additive_tags: ["en:e322", "en:e322i"],
  },
};

export const MOCK_PARTIAL_PRODUCT = {
  ref: "bc-8901719114700",
  kind: "food",
  name: "Local Namkeen Mixture",
  name_provenance: "source",
  brand: "Desi Taste",
  brand_provenance: "source",
  quantity: null,
  quantity_provenance: "missing",
  image_url: null,
  image_provenance: "missing",
  categories: ["Snacks"],
  categories_provenance: "source",
  ingredients: {
    raw_text: null,
    items: [],
    language: null,
    provenance: "missing",
  },
  nutrition: {
    basis: "unknown",
    serving_size: null,
    values: {
      energy_kcal: null,
      energy_kj: null,
      sugars: null,
      added_sugars: null,
      protein: null,
      fat: null,
      saturated_fat: null,
      carbohydrates: null,
      fibre: null,
      sodium: null,
      salt: null,
    },
    provenance: "missing",
  },
  allergens: {
    declared: [],
    traces: [],
    provenance: "missing",
  },
  source: {
    name: "Open Food Facts",
    api_version: "v3",
    product_url: "https://world.openfoodfacts.org/product/8901719114705",
    last_modified: "2026-01-01T00:00:00Z",
    retrieved_at: "2026-10-12T00:00:00Z",
    license: "ODbL",
  },
  completeness: {
    score: 0.25,
    missing: ["ingredients_text", "energy", "sugars", "protein", "fat", "saturated_fat", "carbohydrates", "fibre", "sodium_or_salt", "nutrition_basis"],
  },
  source_computed: null,
};

export const MOCK_BEVERAGE_PRODUCT = {
  ref: "bc-5449000000996",
  kind: "food",
  name: "Coca-Cola Original",
  name_provenance: "source",
  brand: "Coca-Cola",
  brand_provenance: "source",
  quantity: "330 ml",
  quantity_provenance: "source",
  image_url: null,
  image_provenance: "missing",
  categories: ["Beverages", "Carbonated drinks", "Sodas"],
  categories_provenance: "source",
  ingredients: {
    raw_text: "Carbonated water, sugar, colour (caramel E150d), acid (phosphoric acid), natural flavourings including caffeine.",
    items: ["carbonated water", "sugar", "caramel", "phosphoric acid", "caffeine"],
    language: "en",
    provenance: "source",
  },
  nutrition: {
    basis: "per_100ml",
    serving_size: "330ml",
    values: {
      energy_kcal: 42,
      energy_kj: 180,
      sugars: 10.6,
      added_sugars: 10.6,
      protein: 0,
      fat: 0,
      saturated_fat: 0,
      carbohydrates: 10.6,
      fibre: 0,
      sodium: 0,
      salt: 0,
    },
    provenance: "source",
  },
  allergens: {
    declared: [],
    traces: [],
    provenance: "source",
  },
  source: {
    name: "Open Food Facts",
    api_version: "v3",
    product_url: "https://world.openfoodfacts.org/product/5449000000996",
    last_modified: "2026-01-01T00:00:00Z",
    retrieved_at: "2026-10-12T00:00:00Z",
    license: "ODbL",
  },
  completeness: {
    score: 0.95,
    missing: [],
  },
  source_computed: null,
};

export const MOCK_SEARCH_RESULTS = {
  query: "nutella",
  page: 1,
  page_size: 12,
  total: 1,
  page_count: 1,
  results: [
    {
      ref: "bc-3017620422003",
      name: "Nutella Hazelnut Spread",
      brand: "Ferrero",
      image_url: "https://images.openfoodfacts.net/images/products/301/762/042/2003/front_en.883.400.jpg",
      categories: ["Breakfasts", "Spreads"],
      has_ingredients: true,
      nutrition_availability: "most",
      source: "open_food_facts",
    },
  ],
};

export const MOCK_EXPLAIN_SUCCESS = {
  ai_status: "available",
  model: "gemini-2.5-flash",
  prompt_version: "1.0",
  generated_at: "2026-10-12T10:00:00Z",
  summary: "Nutella is a rich cocoa and hazelnut spread with high sugar and fat content per 100g.",
  ingredient_notes: [
    {
      name: "sugar",
      explanation: "Primary sweetening agent and bulking ingredient. Accounts for over 56g per 100g.",
      basis: "product_evidence" as const,
    },
    {
      name: "hazelnuts",
      explanation: "Flavor and texture foundation declared at 13% content.",
      basis: "product_evidence" as const,
    },
  ],
  observations: [
    {
      text: "Saturated fat constitutes approximately one-third of total fat.",
      evidence_refs: ["nutrition.values.saturated_fat", "nutrition.values.fat"],
    },
  ],
  allergen_statement: {
    declared: ["Milk", "Nuts", "Soybeans"],
    note: "Contains hazelnuts, skimmed milk powder, and soy lecithin.",
  },
  missing_info: [],
  caveats: ["Educational summary based solely on declared label facts."],
  validation: {
    passed: true,
    retried: false,
  },
};

/**
 * Setup default mock handlers for standard API endpoints.
 */
export async function setupDefaultMocks(page: Page) {
  await page.route("**/api/v1/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        version: "0.1.0",
        environment: "development",
        gemini_configured: true,
      }),
    });
  });

  await page.route("**/api/v1/products/barcode/3017620422003", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_COMPLETE_PRODUCT),
    });
  });

  await page.route("**/api/v1/products/barcode/8901719114700", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_PARTIAL_PRODUCT),
    });
  });

  await page.route("**/api/v1/products/barcode/5449000000996", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_BEVERAGE_PRODUCT),
    });
  });

  await page.route("**/api/v1/products/barcode/0000000000000", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "NOT_FOUND",
          message: "Product not found in Open Food Facts database.",
          request_id: "mock-not-found-id",
        },
      }),
    });
  });

  await page.route("**/api/v1/products/search*", async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q") || "";
    if (q.toLowerCase().includes("nutella")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SEARCH_RESULTS),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          query: q,
          page: 1,
          page_size: 12,
          total: 0,
          page_count: 0,
          results: [],
        }),
      });
    }
  });

  await page.route("**/api/v1/analysis/explain", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_EXPLAIN_SUCCESS),
    });
  });
}
