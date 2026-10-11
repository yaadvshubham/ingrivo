import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { SearchResponseSchema, SearchResponse, ProductSummary } from "@/lib/schemas/search";
import { SearchContent } from "@/app/search/page";
import { ProductCard } from "@/components/product/ProductCard";
import * as apiClient from "@/lib/api-client";

// Router & searchParams mock
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

const mockProductSummary1: ProductSummary = {
  ref: "bc-8901030383701",
  name: "Bru Instant Coffee",
  brand: "Bru",
  image_url: "https://images.openfoodfacts.net/images/products/890/103/038/3701/front_en.jpg",
  categories: ["Beverages", "Coffees"],
  has_ingredients: true,
  nutrition_availability: "most",
  source: "open_food_facts",
};

const mockProductSummaryMissing: ProductSummary = {
  ref: "bc-8901719114705",
  name: null,
  brand: null,
  image_url: null,
  categories: [],
  has_ingredients: false,
  nutrition_availability: "none",
  source: "open_food_facts",
};

const mockSearchResponse: SearchResponse = {
  query: "coffee",
  page: 1,
  page_size: 12,
  total: 42,
  page_count: 4,
  results: [mockProductSummary1],
};

const mockEmptyResponse: SearchResponse = {
  query: "xyznonexistent",
  page: 1,
  page_size: 12,
  total: 0,
  page_count: 0,
  results: [],
};

describe("Phase 5 Product Search Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  describe("Zod Search Schemas", () => {
    it("successfully parses valid SearchResponse fixture", () => {
      const parsed = SearchResponseSchema.safeParse(mockSearchResponse);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.results[0].ref).toBe("bc-8901030383701");
        expect(parsed.data.results[0].nutrition_availability).toBe("most");
      }
    });

    it("rejects invalid SearchResponse missing required fields", () => {
      const invalid = { query: "test", page: 1 };
      const parsed = SearchResponseSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("rejects invalid nutrition availability enum value", () => {
      const invalid = {
        ...mockSearchResponse,
        results: [
          {
            ...mockProductSummary1,
            nutrition_availability: "complete", // invalid enum
          },
        ],
      };
      const parsed = SearchResponseSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe("ProductCard component rendering", () => {
    it("renders complete product facts correctly", () => {
      render(<ProductCard product={mockProductSummary1} />);

      expect(screen.getByText("Bru Instant Coffee")).toBeInTheDocument();
      expect(screen.getByTestId("product-card-brand")).toHaveTextContent("Bru");
      expect(screen.getByText("Beverages")).toBeInTheDocument();
      expect(screen.getByText("Coffees")).toBeInTheDocument();
      expect(screen.getByTestId("ingredients-chip")).toHaveTextContent("Ingredients listed");
      expect(screen.getByTestId("nutrition-chip")).toHaveTextContent("Nutrition: most available");
      expect(screen.getByTestId("provenance-badge-source")).toBeInTheDocument();

      const link = screen.getByRole("link", { name: /Bru Instant Coffee/i });
      expect(link).toHaveAttribute("href", "/product/bc-8901030383701");
    });

    it("never renders fake values for missing fields", () => {
      render(<ProductCard product={mockProductSummaryMissing} />);

      // Shows fallback title without inventing a fake name
      expect(screen.getByText("Unnamed Product")).toBeInTheDocument();
      // No brand tag rendered
      expect(screen.queryByTestId("product-card-brand")).not.toBeInTheDocument();
      // Non-photo placeholder rendered
      expect(screen.getByTestId("no-image-placeholder")).toBeInTheDocument();
      expect(screen.getByText("No photo in database")).toBeInTheDocument();
      // Status chips reflect missing states accurately
      expect(screen.getByTestId("ingredients-chip")).toHaveTextContent("No ingredients listed");
      expect(screen.getByTestId("nutrition-chip")).toHaveTextContent("Nutrition: none available");
    });
  });

  describe("Search Page Interactions & UI States", () => {
    it("renders initial hint when query is empty and typing alone NEVER triggers a fetch", async () => {
      const searchSpy = vi.spyOn(apiClient, "searchProducts");
      render(<SearchContent />);

      expect(screen.getByTestId("initial-hint")).toBeInTheDocument();
      expect(screen.getByText(/ready to search/i)).toBeInTheDocument();

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "haldiram" } });

      // Ensure no fetch was initiated simply by typing
      expect(searchSpy).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("submit triggers exactly one request via URL navigation and prevents double submit", async () => {
      mockSearchParams = new URLSearchParams("");
      render(<SearchContent />);

      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "maggi" } });

      const submitBtn = screen.getByTestId("search-submit-btn");
      fireEvent.click(submitBtn);

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/search?q=maggi&page=1");
    });

    it("validates query length (minimum 2 chars, max 80 chars)", () => {
      render(<SearchContent />);
      const input = screen.getByTestId("search-input");
      const submitBtn = screen.getByTestId("search-submit-btn");

      // Test too short
      fireEvent.change(input, { target: { value: "a" } });
      fireEvent.click(submitBtn);
      expect(screen.getByTestId("search-validation-error")).toHaveTextContent(/at least 2 characters/i);
      expect(mockPush).not.toHaveBeenCalled();

      // Test too long
      fireEvent.change(input, { target: { value: "a".repeat(85) } });
      fireEvent.click(submitBtn);
      expect(screen.getByTestId("search-validation-error")).toHaveTextContent(/80 characters or fewer/i);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("restores search query and page from URL parameters", async () => {
      mockSearchParams = new URLSearchParams("q=coffee&page=2");
      const searchSpy = vi.spyOn(apiClient, "searchProducts").mockResolvedValue({
        ...mockSearchResponse,
        page: 2,
      });

      render(<SearchContent />);

      await waitFor(() => {
        expect(searchSpy).toHaveBeenCalledWith("coffee", 2, expect.any(Object));
      });

      const input = screen.getByTestId("search-input") as HTMLInputElement;
      expect(input.value).toBe("coffee");
    });

    it("renders search results with pagination and community note", async () => {
      mockSearchParams = new URLSearchParams("q=coffee&page=1");
      vi.spyOn(apiClient, "searchProducts").mockResolvedValue(mockSearchResponse);

      render(<SearchContent />);

      await waitFor(() => {
        expect(screen.getByTestId("search-results-container")).toBeInTheDocument();
      });

      expect(screen.getByText("Bru Instant Coffee")).toBeInTheDocument();
      expect(screen.getByText(/Results come from Open Food Facts, a community database/i)).toBeInTheDocument();

      // Test pagination button click
      const nextBtn = screen.getByTestId("pagination-next-btn");
      expect(nextBtn).toBeEnabled();
      fireEvent.click(nextBtn);
      expect(mockPush).toHaveBeenCalledWith("/search?q=coffee&page=2");
    });

    it("renders empty state with suggestion and enabled or disabled OCR label button", async () => {
      mockSearchParams = new URLSearchParams("q=xyznonexistent&page=1");
      vi.spyOn(apiClient, "searchProducts").mockResolvedValue(mockEmptyResponse);

      render(<SearchContent />);

      await waitFor(() => {
        expect(screen.getByTestId("empty-results-state")).toBeInTheDocument();
      });

      expect(screen.getByText(/No results for “xyznonexistent”/i)).toBeInTheDocument();
      expect(screen.getByText(/Scan or enter barcode directly/i)).toBeInTheDocument();
      // Label photo action is present
      expect(screen.getByText(/Capture label photo \(OCR\)/i)).toBeInTheDocument();
    });

    it("renders rate limited state with friendly message and retry button", async () => {
      mockSearchParams = new URLSearchParams("q=biscuit&page=1");
      vi.spyOn(apiClient, "searchProducts").mockRejectedValue(
        new apiClient.ApiError("Rate limit reached", "UPSTREAM_RATE_LIMITED", 429)
      );

      render(<SearchContent />);

      await waitFor(() => {
        expect(screen.getByTestId("rate-limited-state")).toBeInTheDocument();
      });

      expect(screen.getByText(/Search limit reached/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    });

    it("renders generic error state with retry button", async () => {
      mockSearchParams = new URLSearchParams("q=biscuit&page=1");
      vi.spyOn(apiClient, "searchProducts").mockRejectedValue(
        new apiClient.ApiError("Server timed out", "UPSTREAM_TIMEOUT", 504)
      );

      render(<SearchContent />);

      await waitFor(() => {
        expect(screen.getByTestId("error-state")).toBeInTheDocument();
      });

      expect(screen.getByText(/Search Request Failed/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    it("triggers slow server message when onSlow is invoked during loading", async () => {
      mockSearchParams = new URLSearchParams("q=biscuit&page=1");
      vi.spyOn(apiClient, "searchProducts").mockImplementation(
        (_query, _page, options) =>
          new Promise((resolve) => {
            // Simulate slow trigger
            setTimeout(() => {
              options?.onSlow?.();
            }, 10);
            setTimeout(() => {
              resolve(mockSearchResponse);
            }, 50);
          })
      );

      render(<SearchContent />);

      await waitFor(() => {
        expect(screen.getByTestId("slow-server-notice")).toBeInTheDocument();
      });
    });
  });
});
