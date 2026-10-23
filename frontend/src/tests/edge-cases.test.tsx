import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ProductDetailView } from "@/app/product/[ref]/page";
import { saveHistoryItem, clearHistory } from "@/lib/history-store";
import { Product } from "@/lib/schemas/product";
import * as apiClient from "@/lib/api-client";

const maliciousProduct: Product = {
  ref: "bc-9999999999999",
  kind: "food",
  name: "<script>alert('xss-name')</script><b>Injected Bold</b>",
  name_provenance: "source",
  brand: "<img src=x onerror=alert('xss-brand')>",
  brand_provenance: "source",
  quantity: "100 g",
  quantity_provenance: "source",
  image_url: null,
  image_provenance: "missing",
  categories: ["<script>evil()</script>"],
  categories_provenance: "source",
  ingredients: {
    raw_text: "<script>alert('xss-ingredients')</script> Ingredients text that is very long: " + "a".repeat(300),
    items: ["<script>item</script>"],
    language: "en",
    provenance: "source",
  },
  nutrition: {
    basis: "per_100g",
    serving_size: null,
    values: {
      energy_kcal: 200,
      energy_kj: 840,
      sugars: 10,
      protein: 5,
      fat: 2,
      saturated_fat: 0.5,
      carbohydrates: 30,
      fibre: 2,
      sodium: 0.2,
      salt: 0.5,
    },
    provenance: "source",
  },
  allergens: {
    declared: ["<iframe src=evil.com></iframe>"],
    traces: [],
    provenance: "source",
  },
  source: {
    name: "Open Food Facts",
    api_version: "v3",
    product_url: "https://world.openfoodfacts.org",
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

describe("Edge Cases & Accessibility Hardening (Phase 9)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearHistory();
    vi.restoreAllMocks();
  });

  it("renders script tags and HTML injection safely as plain text without executing (XSS Immunity)", async () => {
    vi.spyOn(apiClient, "getProduct").mockResolvedValue(maliciousProduct);
    const { container } = render(<ProductDetailView refParam="bc-9999999999999" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    // Check that script tags are text content and not HTML elements
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();

    // Text content should contain the literal strings
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "<script>alert('xss-name')</script><b>Injected Bold</b>"
    );
  });

  it("handles long ingredients with accessible Show more / Show less toggle", async () => {
    vi.spyOn(apiClient, "getProduct").mockResolvedValue(maliciousProduct);
    render(<ProductDetailView refParam="bc-9999999999999" />);

    await waitFor(() => {
      expect(screen.getByText(/Show more ingredients/i)).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole("button", { name: /Show more ingredients/i });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent(/Show less/i);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
  });

  it("renders labelled placeholder when product image is missing", async () => {
    vi.spyOn(apiClient, "getProduct").mockResolvedValue(maliciousProduct);
    render(<ProductDetailView refParam="bc-9999999999999" />);

    await waitFor(() => {
      expect(screen.getByLabelText("No product image available")).toBeInTheDocument();
    });
    expect(screen.getByText("No product image available")).toBeInTheDocument();
  });

  it("reopens barcode product from history immediately with saved date and Refresh button", async () => {
    saveHistoryItem({
      ref: maliciousProduct.ref,
      kind: "barcode",
      snapshot: maliciousProduct,
    });

    const getProductSpy = vi.spyOn(apiClient, "getProduct").mockResolvedValue(maliciousProduct);

    render(<ProductDetailView refParam={maliciousProduct.ref} />);

    // Renders immediately from history without calling getProduct on mount
    expect(getProductSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/Viewing saved snapshot from/i)).toBeInTheDocument();

    const refreshBtn = screen.getByRole("button", { name: /Refresh from source/i });
    expect(refreshBtn).toBeInTheDocument();

    // Clicking Refresh triggers getProduct lookup
    fireEvent.click(refreshBtn);
    expect(getProductSpy).toHaveBeenCalledTimes(1);
  });
});
