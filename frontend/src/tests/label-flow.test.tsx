import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import LabelPage from "@/app/label/page";
import { ProductDetailView } from "@/app/product/[ref]/page";
import { saveLabelProduct, clearLabelProduct } from "@/lib/label-store";
import { Product } from "@/lib/schemas/product";
import * as ocrModule from "@/lib/ocr";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("Label OCR, Review, and Product Flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("Asserts no network request is made during the label flow (spies on fetch)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // Mock OCR result
    vi.spyOn(ocrModule, "runOcr").mockResolvedValue({
      fullText: "Organic Toast\nIngredients: Oats, wheat.\nNutrition per 100g:\nEnergy: 350 kcal\nFat: 5g",
      lines: [],
      words: [],
      wordConfidences: [90],
      meanConfidence: 90,
    });

    render(<LabelPage />);

    // Upload a dummy jpeg file
    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])],
      "test.jpg",
      { type: "image/jpeg" }
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      fireEvent.change(input, { target: { files: [file] } });
    }

    // Network request spy must NOT have been called
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Enforces review form gating (cannot continue without confirmation and basis)", async () => {
    vi.spyOn(ocrModule, "runOcr").mockResolvedValue({
      fullText: `
Crunchy Bites
Ingredients: Corn, sugar, salt.
Nutrition Facts:
Energy 400 kcal
Fat 8 g
`,
      lines: [],
      words: [],
      wordConfidences: [],
      meanConfidence: 85,
    });

    render(<LabelPage />);

    // Trigger mock OCR by directly switching into review or clicking through
    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])],
      "test.jpg",
      { type: "image/jpeg" }
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });

    const readBtn = await screen.findByRole("button", { name: /Read label text/i });
    fireEvent.click(readBtn);

    // Should enter review screen
    const submitBtn = await screen.findByRole("button", { name: /Use this information/i });
    expect(submitBtn).toBeDisabled();

    // Check confirmation checkbox
    const confirmCheckbox = screen.getByLabelText(/I have checked this against the label/i);
    expect(confirmCheckbox).not.toBeChecked();

    fireEvent.click(confirmCheckbox);
    expect(confirmCheckbox).toBeChecked();

    // Basis is still not chosen (starts as "not stated" / unknown or empty)
    // Click Per 100 g basis button
    const per100gBtn = screen.getByRole("button", { name: /Per 100 g/i });
    fireEvent.click(per100gBtn);

    // Now button should be enabled!
    expect(submitBtn).not.toBeDisabled();
  });

  it("Enforces column choice gating when two columns are detected", async () => {
    vi.spyOn(ocrModule, "runOcr").mockResolvedValue({
      fullText: `
Granola Crunch
Ingredients: Oats, honey.
Nutrition Information:
Nutrient Per 100g Per Serving % RDA
Energy 450 kcal 135 kcal 7%
Fat 12 g 3.6 g 5%
`,
      lines: [],
      words: [],
      wordConfidences: [],
      meanConfidence: 90,
    });

    render(<LabelPage />);

    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])],
      "test.jpg",
      { type: "image/jpeg" }
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });

    const readBtn = await screen.findByRole("button", { name: /Read label text/i });
    fireEvent.click(readBtn);

    // Screen asks to choose column
    expect(await screen.findByText(/Choose Nutrition Column \(Required\)/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Use this information/i });
    expect(submitBtn).toBeDisabled();

    // Check confirmation checkbox
    const confirmCheckbox = screen.getByLabelText(/I have checked this against the label/i);
    fireEvent.click(confirmCheckbox);
    expect(submitBtn).toBeDisabled(); // Still disabled because column not selected!

    // Choose Column 1 (Per 100 g)
    const colButtons = screen.getAllByRole("button", { name: /Per 100 g/i });
    fireEvent.click(colButtons[0]);

    // Now enabled!
    expect(submitBtn).not.toBeDisabled();
  });

  it("Renders label product page correctly without OFF attribution and shows note", async () => {
    const mockLabelProduct: Product = {
      ref: "lb-00000000-0000-0000-0000-000000000001",
      kind: "label_product",
      name: "Handmade Artisanal Cookies",
      name_provenance: "ocr",
      brand: "Village Bakery",
      brand_provenance: "user_corrected",
      quantity: "250g",
      quantity_provenance: "ocr",
      image_url: null,
      image_provenance: "missing",
      categories: [],
      categories_provenance: "missing",
      ingredients: {
        raw_text: "Flour, butter, sugar, vanilla.",
        items: ["Flour", "butter", "sugar", "vanilla"],
        language: "en",
        provenance: "ocr",
      },
      nutrition: {
        basis: "per_100g",
        serving_size: null,
        values: {
          energy_kcal: 480,
          energy_kj: 2010,
          fat: 22,
          saturated_fat: 14,
          carbohydrates: 65,
          sugars: 28,
          added_sugars: 20,
          protein: 5.5,
          fibre: 2.0,
          salt: 0.6,
          sodium: 0.24,
        },
        provenance: "ocr",
      },
      allergens: {
        declared: ["Milk", "Wheat"],
        traces: [],
        provenance: "ocr",
      },
      source: null,
      completeness: {
        score: 1.0,
        missing: [],
      },
      source_computed: {
        nutriscore: null,
        nova_group: null,
        additive_tags: [],
      },
    };

    saveLabelProduct(mockLabelProduct);

    render(<ProductDetailView refParam={mockLabelProduct.ref} />);

    // Verify "From your label" banner note
    expect(screen.getByText(/Based on text you reviewed from a photo/i)).toBeInTheDocument();

    // Verify product name
    expect(screen.getByText("Handmade Artisanal Cookies")).toBeInTheDocument();

    // Verify brand with user_corrected badge
    expect(screen.getByText("Village Bakery")).toBeInTheDocument();
    expect(screen.getByText(/edited by you/i)).toBeInTheDocument();

    // Verify added sugars row rendered
    expect(screen.getByText(/Added Sugars/i)).toBeInTheDocument();

    // Verify NO Open Food Facts attribution text
    expect(screen.queryByText(/Product data retrieved from Open Food Facts/i)).toBeNull();
    expect(screen.queryByText(/View on Open Food Facts/i)).toBeNull();

    // Verify legal disclaimer is rendered
    expect(screen.getByText(/Ingrivo is for general information only/i)).toBeInTheDocument();
  });

  it("Handles expired/missing label product session entry gracefully", () => {
    clearLabelProduct("lb-nonexistent-uuid");

    render(<ProductDetailView refParam="lb-nonexistent-uuid" />);

    expect(screen.getByText(/Label Data Unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByText(/This label result is only kept in this browser tab and is no longer available/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Scan label photo again/i })).toBeInTheDocument();
  });
});
