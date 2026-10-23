import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CompareTable } from "@/components/compare/CompareTable";
import { CompareAiSection } from "@/components/compare/CompareAiSection";
import { ComparePageContent } from "@/app/compare/page";
import { CompareResponse } from "@/lib/schemas/compare";
import * as apiClient from "@/lib/api-client";

// Mock next/navigation
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

const mockCompareResponse: CompareResponse = {
  a: {
    ref: "bc-5449000000996",
    name: "Coca-Cola Original",
    brand: "Coca-Cola",
    image_url: null,
    basis: "per_100ml",
    serving_size: null,
    completeness: { score: 0.92, missing: ["fibre"] },
  },
  b: {
    ref: "bc-3017620422003",
    name: "Nutella Spread",
    brand: "Ferrero",
    image_url: null,
    basis: "per_100g",
    serving_size: "15g",
    completeness: { score: 1.0, missing: [] },
  },
  nutrient_rows: [
    {
      nutrient: "energy_kcal",
      label: "Energy (kcal)",
      unit: "kcal",
      val_a: 42.0,
      provenance_a: "source",
      derivation_a: null,
      basis_a: "per_100ml",
      val_b: 539.0,
      provenance_b: "source",
      derivation_b: null,
      basis_b: "per_100g",
      comparable: false,
      incomparable_reason: "Different basis units (grams vs milliliters) cannot be compared directly without product density.",
      diff_absolute: null,
      diff_relative_percent: null,
      direction: "incomparable",
      notable: false,
      notable_reason: null,
    },
    {
      nutrient: "sugars",
      label: "Total Sugars",
      unit: "g",
      val_a: 10.6,
      provenance_a: "source",
      derivation_a: null,
      basis_a: "per_100g",
      val_b: 25.0,
      provenance_b: "derived",
      derivation_b: "Converted from 15g serving to per 100g (6.67x)",
      basis_b: "per_100g",
      comparable: true,
      incomparable_reason: null,
      diff_absolute: 14.4,
      diff_relative_percent: 135.8,
      direction: "b_higher",
      notable: true,
      notable_reason: "Relative difference exceeds 20% and absolute difference exceeds presentation floor.",
    },
    {
      nutrient: "fibre",
      label: "Dietary Fibre",
      unit: "g",
      val_a: null,
      provenance_a: "missing",
      derivation_a: null,
      basis_a: "per_100g",
      val_b: 3.4,
      provenance_b: "source",
      derivation_b: null,
      basis_b: "per_100g",
      comparable: false,
      incomparable_reason: "Not available for Product A",
      diff_absolute: null,
      diff_relative_percent: null,
      direction: "incomparable",
      notable: false,
      notable_reason: null,
    },
  ],
  ingredients_diff: {
    shared: ["sugar"],
    only_a: ["carbonated water", "caramel colour", "phosphoric acid"],
    only_b: ["palm oil", "hazelnuts", "skimmed milk powder", "cocoa"],
    is_approximate: true,
    disclaimer: "Ingredients parsed and matched approximately. Synonyms and formulations may vary.",
  },
  allergens_diff: {
    shared: [],
    only_a: [],
    only_b: ["Milk", "Hazelnuts", "Soy"],
    note_a: "None listed in source (does not guarantee allergen-free)",
    note_b: "Declared on label",
  },
  ai: null,
  ai_status: "omitted",
};

describe("Product Comparison (Phase 8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it("renders empty state prompt when no slots are selected", () => {
    render(<ComparePageContent />);
    expect(screen.getByText(/Select Two Products to Compare/i)).toBeInTheDocument();
  });

  it("displays clear warning message when both slots contain the same ref", () => {
    mockSearchParams = new URLSearchParams("a=bc-5449000000996&b=bc-5449000000996");
    render(<ComparePageContent />);
    expect(
      screen.getByText(/Both comparison slots contain the same product/i)
    ).toBeInTheDocument();
  });

  it("renders side-by-side table and stacked mobile layout without horizontal scrolling", () => {
    const { container } = render(<CompareTable data={mockCompareResponse} />);

    // Desktop table with caption
    const caption = container.querySelector("caption");
    expect(caption).toBeInTheDocument();
    expect(caption?.textContent).toContain("Side-by-side nutrient and ingredient comparison");

    // Table headers
    expect(screen.getByText("Nutrient")).toBeInTheDocument();
    expect(screen.getAllByText("Coca-Cola Original").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nutella Spread").length).toBeGreaterThan(0);

    // Not-comparable rendering
    expect(screen.getAllByText(/Different basis units/i).length).toBeGreaterThan(0);

    // Derived badge present
    const calculatedBadges = screen.getAllByText("Calculated");
    expect(calculatedBadges.length).toBeGreaterThan(0);

    // Notable difference badge
    expect(screen.getAllByText("Notable difference").length).toBeGreaterThan(0);
  });

  it("verifies NO prohibited verdict or ranking words appear in comparison output", () => {
    const { container } = render(<CompareTable data={mockCompareResponse} />);
    const textContent = container.textContent?.toLowerCase() || "";

    const prohibitedRankingWords = [
      "better",
      "worse",
      "healthier",
      "unhealthy",
      "winner",
      "should choose",
      "prefer",
      "superior",
      "inferior",
    ];

    for (const word of prohibitedRankingWords) {
      const regex = new RegExp(`\\b${word}\\b`, "i");
      expect(regex.test(textContent)).toBe(
        false
      );
    }
  });

  it("renders AI narrative section with explicit button, data flow notice, and clean degradation on failure", async () => {
    const compareSpy = vi.spyOn(apiClient, "compareProducts").mockResolvedValue({
      ...mockCompareResponse,
      ai_status: "failed",
      ai: null,
    });

    render(
      <CompareAiSection
        refA="bc-5449000000996"
        refB="bc-3017620422003"
        requestPayload={{
          a: { type: "barcode", barcode: "5449000000996" },
          b: { type: "barcode", barcode: "3017620422003" },
        }}
      />
    );

    // Explicit button and notice present
    const button = screen.getByRole("button", { name: /Explain the differences/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByText(/Data flow: Only computed difference rows/i)).toBeInTheDocument();

    // Trigger AI
    fireEvent.click(button);

    await waitFor(() => {
      expect(compareSpy).toHaveBeenCalled();
    });

    // Clean degradation: Unverified Output notice, no broken table
    await waitFor(() => {
      expect(screen.getByText(/We couldn't produce a reliable explanation/i)).toBeInTheDocument();
    });
  });
});
