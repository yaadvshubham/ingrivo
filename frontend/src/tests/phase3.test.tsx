import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ProductSchema, Product } from "@/lib/schemas/product";
import { isValidBarcode, normalizeBarcode } from "@/lib/barcode";
import ScanPage from "@/app/scan/page";
import { ProductDetailView } from "@/app/product/[ref]/page";
import * as apiClient from "@/lib/api-client";

// Sample fixture based on real Coca-Cola fixture (5449000000996)
const mockNormalizedProduct: Product = {
  ref: "bc-5449000000996",
  kind: "food",
  name: "Coca-Cola",
  name_provenance: "source",
  brand: "Coca-Cola",
  brand_provenance: "source",
  quantity: "330 ml",
  quantity_provenance: "source",
  image_url: "https://images.openfoodfacts.net/test.jpg",
  image_provenance: "source",
  categories: ["Colas", "Sodas"],
  categories_provenance: "source",
  ingredients: {
    raw_text: "Carbonated water, sugar, caramel color, phosphoric acid.",
    items: ["carbonated water", "sugar"],
    language: "en",
    provenance: "source",
  },
  nutrition: {
    basis: "per_100g",
    serving_size: null,
    values: {
      energy_kcal: 42,
      energy_kj: 180,
      sugars: 10.6,
      protein: 0,
      fat: 0,
      saturated_fat: 0,
      carbohydrates: 10.6,
      fibre: null, // missing stay null
      sodium: 0,
      salt: 0,
    },
    provenance: "source",
  },
  allergens: {
    declared: [],
    traces: [],
    provenance: "missing",
  },
  source: {
    name: "Open Food Facts",
    api_version: "v3",
    product_url: "https://world.openfoodfacts.org/product/5449000000996",
    last_modified: "2024-03-22T08:14:02Z",
    retrieved_at: "2026-10-11T12:00:00Z",
    license: "ODbL",
  },
  completeness: {
    score: 0.92,
    missing: ["fibre"],
  },
  source_computed: {
    nutriscore: "e",
    nova_group: 4,
    additive_tags: ["en:e150d", "en:e338"],
  },
};

// Mock useRouter
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("Phase 3 Frontend Tests", () => {
  describe("Zod Product Schema Parsing", () => {
    it("successfully parses normalized product sample", () => {
      const parsed = ProductSchema.safeParse(mockNormalizedProduct);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe("Coca-Cola");
        expect(parsed.data.nutrition.values.fibre).toBeNull();
      }
    });

    it("rejects invalid payloads missing required attributes", () => {
      const invalid = { ref: "bc-123", name: "Incomplete" };
      const parsed = ProductSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe("Barcode Utilities (matching backend table)", () => {
    const testCases: [string, boolean, string][] = [
      ["5449000000996", true, "5449000000996"],
      ["3017620422003", true, "3017620422003"],
      ["8000500003787", true, "8000500003787"],
      ["012345678905", true, "0012345678905"],
      ["40123455", true, "40123455"],
      ["0000000000000", true, "0000000000000"],
      [" 5449000000996 ", true, "5449000000996"],
      ["5449000000997", false, "5449000000997"],
      ["123", false, "123"],
      ["barcode", false, "barcode"],
    ];

    testCases.forEach(([code, expectedValid, expectedNormalized]) => {
      it(`validates "${code}" as ${expectedValid}`, () => {
        expect(isValidBarcode(code)).toBe(expectedValid);
        if (expectedValid) {
          expect(normalizeBarcode(code)).toBe(expectedNormalized);
        }
      });
    });
  });

  describe("Scan Page Manual Entry Form", () => {
    it("validates empty input and shows error", () => {
      render(<ScanPage />);
      const submitBtn = screen.getByRole("button", { name: /look up product/i });
      fireEvent.click(submitBtn);
      expect(screen.getByRole("alert")).toHaveTextContent(/please enter a barcode/i);
    });

    it("validates bad check digit and shows clear error message", () => {
      render(<ScanPage />);
      const input = screen.getByLabelText(/barcode number/i);
      fireEvent.change(input, { target: { value: "5449000000997" } });
      const submitBtn = screen.getByRole("button", { name: /look up product/i });
      fireEvent.click(submitBtn);
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid check digit/i);
    });

    it("accepts valid barcode with leading zero and navigates with string intact", () => {
      render(<ScanPage />);
      const input = screen.getByLabelText(/barcode number/i);
      // Valid UPC-A with leading zero
      fireEvent.change(input, { target: { value: "012345678905" } });
      const submitBtn = screen.getByRole("button", { name: /look up product/i });
      fireEvent.click(submitBtn);
      // Normalizes 012345678905 to 0012345678905
      expect(mockPush).toHaveBeenCalledWith("/product/bc-0012345678905");
    });
  });

  describe("Product Detail Page States", () => {
    it("renders found product facts with missing chips for null fields", async () => {
      vi.spyOn(apiClient, "getProduct").mockResolvedValue(mockNormalizedProduct);
      render(<ProductDetailView refParam="bc-5449000000996" />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Coca-Cola", level: 1 })).toBeInTheDocument();
      });

      expect(screen.getByText("Basis: per 100 g")).toBeInTheDocument();
      expect(screen.getByText("Dietary Fibre")).toBeInTheDocument();
      // Nutrition missing chip rendered for fibre
      expect(screen.getByTestId("missing-chip")).toBeInTheDocument();
    });

    it("renders product not found state with alternatives", async () => {
      vi.spyOn(apiClient, "getProduct").mockRejectedValue(
        new apiClient.ApiError("Not found", "PRODUCT_NOT_FOUND", 404, ["label_scan", "manual_search"])
      );
      render(<ProductDetailView refParam="bc-7622300710260" />);

      await waitFor(() => {
        expect(screen.getByText(/product not found/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/search product by title/i)).toBeInTheDocument();
      expect(screen.getByText(/capture label photo/i)).toBeInTheDocument();
    });

    it("renders rate limited error state", async () => {
      vi.spyOn(apiClient, "getProduct").mockRejectedValue(
        new apiClient.ApiError("Too many requests", "UPSTREAM_RATE_LIMITED", 503)
      );
      render(<ProductDetailView refParam="bc-5449000000996" />);

      await waitFor(() => {
        expect(screen.getByText(/rate limit reached/i)).toBeInTheDocument();
      });
    });

    it("renders invalid product reference format message", async () => {
      render(<ProductDetailView refParam="invalid-code-format" />);

      await waitFor(() => {
        expect(screen.getByText(/invalid product reference/i)).toBeInTheDocument();
      });
    });
  });
});
