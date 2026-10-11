"use client";

import React, { useState, useEffect, Suspense, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search as SearchIcon,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Barcode,
  Camera,
  Info,
} from "lucide-react";
import { searchProducts, ApiError } from "@/lib/api-client";
import { SearchResponse } from "@/lib/schemas/search";
import { ProductCard } from "@/components/product/ProductCard";
import { DisabledAction } from "@/components/DisabledAction";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const urlQuery = searchParams.get("q") || "";
  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : Math.min(pageParam, 5);

  const [inputVal, setInputVal] = useState(urlQuery);
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  const [prevPage, setPrevPage] = useState(currentPage);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(urlQuery.trim()));
  const [isSlow, setIsSlow] = useState<boolean>(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  if (urlQuery !== prevUrlQuery || currentPage !== prevPage) {
    setPrevUrlQuery(urlQuery);
    setPrevPage(currentPage);
    setInputVal(urlQuery);
    setLoading(Boolean(urlQuery.trim()));
    setError(null);
    setIsSlow(false);
  }

  // Execute search ONLY when URL query changes or retryTrigger fires
  useEffect(() => {
    const trimmed = urlQuery.trim();
    if (!trimmed) {
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    searchProducts(trimmed, currentPage, {
      signal: controller.signal,
      onSlow: () => {
        if (isMounted) setIsSlow(true);
      },
    })
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err);
          } else if (err instanceof Error && err.name === "AbortError") {
            return;
          } else {
            setError(
              new ApiError(
                err instanceof Error ? err.message : "An unexpected network error occurred.",
                "NETWORK_ERROR",
                0
              )
            );
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [urlQuery, currentPage, retryTrigger]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent double submit

    const trimmed = inputVal.trim();
    if (trimmed.length < 2) {
      setValidationError("Search query must be at least 2 characters long.");
      return;
    }
    if (trimmed.length > 80) {
      setValidationError("Search query must be 80 characters or fewer.");
      return;
    }

    setValidationError(null);
    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(trimmed)}&page=1`);
    });
  };

  const handlePageChange = (newPage: number) => {
    if (loading || newPage < 1 || newPage > 5) return;
    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(urlQuery.trim())}&page=${newPage}`);
    });
  };

  const hasQuery = Boolean(urlQuery.trim());
  const activeLoading = hasQuery && loading;
  const activeData = hasQuery ? data : null;
  const activeError = hasQuery ? error : null;

  const isRateLimited =
    activeError?.code === "RATE_LIMITED" ||
    activeError?.code === "UPSTREAM_RATE_LIMITED" ||
    activeError?.status === 429;

  const maxPage = activeData ? Math.min(Math.max(activeData.page_count, 1), 5) : 1;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Search Header & Form */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1B2A22]">
            Search Packaged Foods
          </h1>
          <p className="text-sm text-[#5E6B63]">
            Look up nutrition facts, ingredients, and allergen declarations by brand or product name.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2" noValidate>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5E6B63]" aria-hidden="true" />
              <Input
                type="text"
                id="search-query-input"
                data-testid="search-input"
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Search by title or brand (e.g. Parle-G, Maggi, Amul butter)..."
                className="pl-10 h-11 bg-white border-[#E4DEC3] focus-visible:ring-[#1E5B45] text-sm"
              />
            </div>
            <Button
              type="submit"
              data-testid="search-submit-btn"
              disabled={loading}
              className="h-11 px-6 bg-[#1E5B45] hover:bg-[#1E5B45]/90 text-white font-medium"
            >
              {loading ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <SearchIcon className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          {validationError && (
            <p data-testid="search-validation-error" className="text-xs text-red-600 font-medium">
              {validationError}
            </p>
          )}
        </form>

        {/* Database Disclaimer Note */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-[#E4DEC3] bg-[#FBF8F2] text-xs text-[#5E6B63]">
          <Info className="h-4 w-4 shrink-0 text-[#1E5B45] mt-0.5" aria-hidden="true" />
          <p>
            Results come from Open Food Facts, a community database. Coverage of Indian products may be incomplete.
          </p>
        </div>
      </div>

      {/* Slow Server Indicator */}
      {activeLoading && isSlow && (
        <div
          role="status"
          data-testid="slow-server-notice"
          className="flex items-center gap-3 p-3.5 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-900"
        >
          <Clock className="h-4 w-4 shrink-0 text-amber-700 animate-spin" />
          <span>
            Waking up the server or contacting Open Food Facts, this may take a few moments...
          </span>
        </div>
      )}

      {/* State 1: Initial Hint (No Query) */}
      {!hasQuery && (
        <div data-testid="initial-hint" className="py-12 px-4 text-center space-y-4 max-w-lg mx-auto">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EFECE4] text-[#1E5B45]">
            <SearchIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-[#1B2A22]">
            Ready to search
          </h2>
          <p className="text-sm text-[#5E6B63] leading-relaxed">
            Enter a product brand or name above and press <strong>Search</strong> or <kbd className="px-1.5 py-0.5 text-xs bg-stone-100 border border-stone-300 rounded">Enter</kbd>.
            You can also look up a product directly by barcode.
          </p>
          <div>
            <Link
              href="/scan"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Barcode className="h-4 w-4 mr-2" />
              Scan or enter barcode
            </Link>
          </div>
        </div>
      )}

      {/* State 2: Loading Skeletons */}
      {activeLoading && (
        <div data-testid="loading-skeleton" className="space-y-4">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="border border-[#E4DEC3] bg-white p-5">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <Skeleton className="w-full sm:w-28 h-28 rounded-lg bg-[#EFECE4] shrink-0" />
                <div className="space-y-3 flex-1 w-full">
                  <Skeleton className="h-4 w-28 bg-[#EFECE4]" />
                  <Skeleton className="h-6 w-3/4 bg-[#EFECE4]" />
                  <Skeleton className="h-4 w-1/3 bg-[#EFECE4]" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-5 w-24 bg-[#EFECE4]" />
                    <Skeleton className="h-5 w-28 bg-[#EFECE4]" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* State 3: Rate Limited Error */}
      {!activeLoading && activeError && isRateLimited && (
        <Card data-testid="rate-limited-state" className="border border-amber-300 bg-amber-50/60 shadow-xs">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#1B2A22]">Search limit reached</h2>
              <p className="text-sm text-[#5E6B63] max-w-md mx-auto">
                Too many searches were made recently. Please wait a minute before making another search to respect community service limits.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setLoading(true);
                setError(null);
                setIsSlow(false);
                setRetryTrigger((prev) => prev + 1);
              }}
              className="mt-2 border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* State 4: Other Error with Retry */}
      {!activeLoading && activeError && !isRateLimited && (
        <Card data-testid="error-state" className="border border-red-200 bg-red-50/40 shadow-xs">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#1B2A22]">Search Request Failed</h2>
              <p className="text-sm text-[#5E6B63] max-w-md mx-auto">
                {activeError.message || "An unexpected error occurred while communicating with Open Food Facts."}
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="default"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setIsSlow(false);
                  setRetryTrigger((prev) => prev + 1);
                }}
                className="bg-[#1E5B45] text-white hover:bg-[#1E5B45]/90"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* State 5: Empty Result */}
      {!activeLoading && !activeError && activeData && activeData.results.length === 0 && (
        <Card data-testid="empty-results-state" className="border border-[#E4DEC3] bg-white shadow-xs">
          <CardContent className="p-8 text-center space-y-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-[#5E6B63]">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-[#1B2A22]">No products found</h2>
              <p className="text-sm text-[#5E6B63] max-w-md mx-auto">
                No results for &ldquo;{activeData.query}&rdquo;. Try fewer words or just the brand, or scan the barcode.
              </p>
            </div>

            <div className="space-y-3 pt-2 max-w-md mx-auto text-left">
              <p className="text-xs font-semibold text-[#1B2A22] uppercase tracking-wider">
                Alternative Lookup Options
              </p>
              <div className="flex flex-col gap-2.5">
                <Link
                  href="/scan"
                  className={buttonVariants({ variant: "outline", className: "justify-start gap-2 h-11" })}
                >
                  <Barcode className="h-4 w-4 text-[#1E5B45]" />
                  <span>Scan or enter barcode directly</span>
                </Link>

                <DisabledAction
                  label="Capture label photo (OCR)"
                  explanation="On-device OCR parsing planned for Phase 6"
                  icon={<Camera className="h-4 w-4" />}
                  variant="outline"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* State 6: Search Results */}
      {!activeLoading && !activeError && activeData && activeData.results.length > 0 && (
        <div data-testid="search-results-container" className="space-y-6">
          <div className="flex items-center justify-between text-xs text-[#5E6B63] border-b border-[#E4DEC3] pb-3">
            <span>
              Showing {activeData.results.length} result{activeData.results.length === 1 ? "" : "s"} for &ldquo;
              <strong className="text-[#1B2A22]">{activeData.query}</strong>&rdquo;
              {activeData.total !== null && activeData.total !== undefined && ` (approx. ${activeData.total} total)`}
            </span>
            <span>
              Page {activeData.page} of {maxPage}
            </span>
          </div>

          <div className="space-y-4">
            {activeData.results.map((product) => (
              <ProductCard key={product.ref} product={product} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E4DEC3]">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => handlePageChange(currentPage - 1)}
              data-testid="pagination-prev-btn"
              className="gap-1 text-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <span className="text-xs text-[#5E6B63] font-medium">
              Page {currentPage} of {maxPage}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= maxPage || loading}
              onClick={() => handlePageChange(currentPage + 1)}
              data-testid="pagination-next-btn"
              className="gap-1 text-xs"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
          <Skeleton className="h-8 w-60 bg-[#EFECE4]" />
          <Skeleton className="h-11 w-full bg-[#EFECE4]" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
