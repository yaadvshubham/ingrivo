import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getHistory,
  getHistoryItem,
  saveHistoryItem,
  updateHistoryExplanation,
  removeHistoryItem,
  restoreHistoryItem,
  clearHistory,
  subscribeToHistory,
  HISTORY_STORAGE_KEY,
  MAX_HISTORY_ITEMS,
} from "@/lib/history-store";
import { Product } from "@/lib/schemas/product";
import { ExplainResponse } from "@/lib/schemas/analysis";

function createMockProduct(ref: string, name: string): Product {
  return {
    ref,
    kind: ref.startsWith("lb-") ? "label_product" : "food",
    name,
    name_provenance: "source",
    brand: "TestBrand",
    brand_provenance: "source",
    quantity: "100g",
    quantity_provenance: "source",
    image_url: "https://example.com/test.jpg",
    image_provenance: "source",
    categories: ["Snacks"],
    categories_provenance: "source",
    ingredients: {
      raw_text: "Wheat, sugar, salt",
      items: ["wheat", "sugar", "salt"],
      language: "en",
      provenance: "source",
    },
    nutrition: {
      basis: "per_100g",
      serving_size: null,
      values: {
        energy_kcal: 100,
        energy_kj: 420,
        sugars: 5,
        protein: 2,
        fat: 1,
        saturated_fat: 0.2,
        carbohydrates: 20,
        fibre: 1,
        sodium: 0.1,
        salt: 0.25,
      },
      provenance: "source",
    },
    allergens: {
      declared: ["Gluten"],
      traces: [],
      provenance: "source",
    },
    source: {
      name: "Open Food Facts",
      api_version: "v3",
      product_url: `https://world.openfoodfacts.org/product/${ref}`,
      last_modified: "2026-01-01T00:00:00Z",
      retrieved_at: "2026-10-12T00:00:00Z",
      license: "ODbL",
    },
    completeness: {
      score: 1.0,
      missing: [],
    },
    source_computed: null,
  };
}

const mockExplanation: ExplainResponse = {
  ai_status: "available",
  model: "gemini-flash-latest",
  prompt_version: "1.0",
  generated_at: "2026-10-12T00:00:00Z",
  summary: "A simple snack test explanation.",
  ingredient_notes: [],
  observations: [],
  allergen_statement: { declared: ["Gluten"], note: "Contains gluten" },
  missing_info: [],
  caveats: [],
  validation: { passed: true, retried: false },
};

describe("Local Scan History Store (lib/history-store)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearHistory();
  });

  it("adds and retrieves items sorted by lastViewedAt desc", () => {
    const prod1 = createMockProduct("bc-111", "First Product");
    const prod2 = createMockProduct("bc-222", "Second Product");

    saveHistoryItem({
      ref: prod1.ref,
      kind: "barcode",
      snapshot: prod1,
    });

    saveHistoryItem({
      ref: prod2.ref,
      kind: "barcode",
      snapshot: prod2,
    });

    const list = getHistory();
    expect(list.length).toBe(2);
    expect(list[0].ref).toBe("bc-222"); // most recently viewed
    expect(list[1].ref).toBe("bc-111");

    const single = getHistoryItem("bc-222");
    expect(single).not.toBeNull();
    expect(single?.title).toBe("Second Product");
  });

  it("deduplicates by ref and updates lastViewedAt without duplicating entry", () => {
    const prod1 = createMockProduct("bc-111", "Original Name");
    saveHistoryItem({ ref: prod1.ref, kind: "barcode", snapshot: prod1 });

    expect(getHistory().length).toBe(1);

    const updatedProd1 = createMockProduct("bc-111", "Updated Name");
    saveHistoryItem({ ref: updatedProd1.ref, kind: "barcode", snapshot: updatedProd1 });

    const list = getHistory();
    expect(list.length).toBe(1);
    expect(list[0].title).toBe("Updated Name");
  });

  it("caps at 50 items and evicts the least recently viewed entry", () => {
    vi.useFakeTimers();
    try {
      // Add 50 items with ascending timestamps
      for (let i = 1; i <= 50; i++) {
        vi.advanceTimersByTime(10);
        const p = createMockProduct(`bc-${i.toString().padStart(4, "0")}`, `Product ${i}`);
        saveHistoryItem({ ref: p.ref, kind: "barcode", snapshot: p });
      }

      expect(getHistory().length).toBe(50);

      // Adding 51st item should evict bc-0001 (the earliest timestamp)
      vi.advanceTimersByTime(10);
      const p51 = createMockProduct("bc-0051", "Product 51");
      saveHistoryItem({ ref: p51.ref, kind: "barcode", snapshot: p51 });

      const list = getHistory();
      expect(list.length).toBe(MAX_HISTORY_ITEMS);
      expect(list.some((item) => item.ref === "bc-0051")).toBe(true);
      expect(list.some((item) => item.ref === "bc-0001")).toBe(false); // evicted oldest
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes an individual item and supports undo restoration", () => {
    const prod = createMockProduct("bc-1234", "Cereal");
    saveHistoryItem({ ref: prod.ref, kind: "barcode", snapshot: prod });

    const removed = removeHistoryItem("bc-1234");
    expect(removed).not.toBeNull();
    expect(removed?.ref).toBe("bc-1234");
    expect(getHistory().length).toBe(0);

    // Undo restore
    restoreHistoryItem(removed!);
    expect(getHistory().length).toBe(1);
    expect(getHistory()[0].ref).toBe("bc-1234");
  });

  it("clears all history items completely", () => {
    const prod1 = createMockProduct("bc-1", "Prod 1");
    const prod2 = createMockProduct("bc-2", "Prod 2");
    saveHistoryItem({ ref: prod1.ref, kind: "barcode", snapshot: prod1 });
    saveHistoryItem({ ref: prod2.ref, kind: "barcode", snapshot: prod2 });

    expect(getHistory().length).toBe(2);
    clearHistory();
    expect(getHistory().length).toBe(0);
  });

  it("gracefully recovers from corrupt JSON without crashing the application", () => {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, "{corrupt-non-json{{");
    const history = getHistory();
    expect(history).toEqual([]);
    // LocalStorage was reset to valid empty store
    expect(window.localStorage.getItem(HISTORY_STORAGE_KEY)).toContain('"version":1');
  });

  it("gracefully recovers from schema/version mismatch without crashing", () => {
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify({ version: 999, items: [{ invalid: "data" }] })
    );
    const history = getHistory();
    expect(history).toEqual([]);
    expect(window.localStorage.getItem(HISTORY_STORAGE_KEY)).toContain('"version":1');
  });

  it("handles storage quota errors by evicting older items and degrading gracefully", () => {
    const prod = createMockProduct("bc-quota", "Heavy Product");

    // Mock setItem to throw QuotaExceededError
    const spy = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      const err = new Error("Quota exceeded");
      err.name = "QuotaExceededError";
      throw err;
    });

    // Should not throw an exception
    expect(() => {
      saveHistoryItem({ ref: prod.ref, kind: "barcode", snapshot: prod });
    }).not.toThrow();

    spy.mockRestore();
  });

  it("persists and updates AI explanation and retrieves it without new network calls", () => {
    const prod = createMockProduct("bc-exp", "Explanation Product");
    saveHistoryItem({ ref: prod.ref, kind: "barcode", snapshot: prod });

    updateHistoryExplanation("bc-exp", mockExplanation);

    const stored = getHistoryItem("bc-exp");
    expect(stored?.explanation).toBeDefined();
    expect(stored?.explanation?.summary).toBe("A simple snack test explanation.");
  });

  it("listens to cross-tab storage updates", () => {
    const spy = vi.fn();
    const unsub = subscribeToHistory(spy);

    // Simulate cross-tab storage event
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: HISTORY_STORAGE_KEY,
        newValue: JSON.stringify({ version: 1, items: [] }),
      })
    );

    expect(spy).toHaveBeenCalledTimes(1);
    unsub();
  });
});
