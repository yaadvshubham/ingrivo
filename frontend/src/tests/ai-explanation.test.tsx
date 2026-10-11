import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AiExplanationSection } from "@/components/product/AiExplanationSection";
import { Product } from "@/lib/schemas/product";
import { ExplainResponse } from "@/lib/schemas/analysis";
import * as apiClient from "@/lib/api-client";

const mockProduct: Product = {
  ref: "bc-8901030383701",
  kind: "packaged_food",
  name: "Bru Instant Coffee",
  name_provenance: "source",
  brand: "Bru",
  brand_provenance: "source",
  quantity: "100g",
  quantity_provenance: "source",
  image_url: null,
  image_provenance: "missing",
  categories: ["Beverages"],
  categories_provenance: "source",
  ingredients: {
    raw_text: "Coffee (70%), Chicory (30%).",
    items: ["Coffee", "Chicory"],
    language: "en",
    provenance: "source",
  },
  nutrition: {
    basis: "per_100g",
    serving_size: "2g",
    provenance: "source",
    values: {
      energy_kcal: 320,
      energy_kj: 1340,
      fat: 0.5,
      saturated_fat: 0.1,
      carbohydrates: 60,
      sugars: 5,
      added_sugars: null,
      fibre: 15,
      protein: 12,
      salt: 0.2,
      sodium: 0.08,
    },
  },
  allergens: { declared: [], traces: [], provenance: "source" },
  completeness: { score: 0.9, missing: [] },
  source: {
    name: "Open Food Facts",
    retrieved_at: "2026-10-12T00:00:00Z",
    license: "ODbL",
  },
};

const mockExplainSuccess: ExplainResponse = {
  ai_status: "available",
  model: "gemini-2.5-flash",
  prompt_version: "2026-10-12.v1",
  generated_at: "2026-10-12T00:00:00Z",
  summary: "Bru Instant Coffee blends roasted coffee and chicory providing 320 kcal per 100 g.",
  ingredient_notes: [
    {
      name: "Coffee",
      explanation: "Constitutes 70% of the roasted blend providing aroma and natural caffeine.",
      basis: "product_evidence",
    },
    {
      name: "Chicory",
      explanation: "Roasted root contributing rich earthy notes and enhancing body.",
      basis: "general_knowledge",
    },
  ],
  observations: [
    {
      text: "Contains 5 g sugars per 100 g.",
      evidence_refs: ["nutrition.sugars", "nutrition_basis"],
    },
  ],
  allergen_statement: {
    declared: [],
    note: "No allergens declared on packaging.",
  },
  missing_info: ["Added sugars are not declared."],
  caveats: ["Values stated per 100 g dry powder."],
  validation: { passed: true, retried: false },
};

describe("Phase 7 AI Explanations Frontend Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("does not initiate any network request on initial render (idle state)", () => {
    const fetchSpy = vi.spyOn(window, "fetch");
    render(<AiExplanationSection product={mockProduct} />);

    expect(screen.getByText(/AI Product Explanation/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /explain this product/i })).toBeInTheDocument();
    expect(screen.getByTestId("ai-data-flow-notice")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders data-flow notice next to the action button", () => {
    render(<AiExplanationSection product={mockProduct} />);
    const notice = screen.getByTestId("ai-data-flow-notice");
    expect(notice).toHaveTextContent(/Data Flow & Privacy Disclosure/i);
    expect(notice).toHaveTextContent(/Google's Gemini API/i);
  });

  it("triggers exactly one request on click and renders success state with split notes", async () => {
    const explainSpy = vi.spyOn(apiClient, "explainProduct").mockResolvedValue(mockExplainSuccess);

    render(<AiExplanationSection product={mockProduct} />);
    const btn = screen.getByRole("button", { name: /explain this product/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByTestId("ai-success-container")).toBeInTheDocument();
    });

    expect(explainSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(mockExplainSuccess.summary)).toBeInTheDocument();

    // Verify split ingredient notes
    expect(screen.getByText(/From this product's information/i)).toBeInTheDocument();
    expect(screen.getByTestId("note-product-evidence")).toHaveTextContent("Coffee");

    expect(screen.getByText(/General knowledge about these ingredients/i)).toBeInTheDocument();
    expect(screen.getByTestId("note-general-knowledge")).toHaveTextContent("Chicory");

    // Verify session storage caching
    expect(sessionStorage.getItem(`ingrivo_explain_${mockProduct.ref}`)).toBeTruthy();
  });

  it("renders rate limited state gracefully without affecting facts", async () => {
    vi.spyOn(apiClient, "explainProduct").mockRejectedValue(
      new apiClient.ApiError("Rate limit reached", "RATE_LIMITED", 429)
    );

    render(<AiExplanationSection product={mockProduct} />);
    fireEvent.click(screen.getByRole("button", { name: /explain this product/i }));

    await waitFor(() => {
      expect(screen.getByTestId("ai-rate-limited-state")).toBeInTheDocument();
    });
    expect(screen.getByText(/Explanation limit reached/i)).toBeInTheDocument();
  });

  it("renders invalid output state when validation fails", async () => {
    vi.spyOn(apiClient, "explainProduct").mockRejectedValue(
      new apiClient.ApiError("We couldn't produce a reliable explanation", "AI_INVALID_OUTPUT", 502)
    );

    render(<AiExplanationSection product={mockProduct} />);
    fireEvent.click(screen.getByRole("button", { name: /explain this product/i }));

    await waitFor(() => {
      expect(screen.getByTestId("ai-invalid-output-state")).toBeInTheDocument();
    });
    expect(screen.getByText(/We couldn't produce a reliable explanation; the facts above are unaffected/i)).toBeInTheDocument();
  });

  it("renders not configured state when API key is missing on backend", async () => {
    vi.spyOn(apiClient, "explainProduct").mockRejectedValue(
      new apiClient.ApiError("Gemini not configured", "AI_NOT_CONFIGURED", 503)
    );

    render(<AiExplanationSection product={mockProduct} />);
    fireEvent.click(screen.getByRole("button", { name: /explain this product/i }));

    await waitFor(() => {
      expect(screen.getByTestId("ai-not-configured-state")).toBeInTheDocument();
    });
    expect(screen.getByText(/AI Explanations Not Configured/i)).toBeInTheDocument();
  });
});
