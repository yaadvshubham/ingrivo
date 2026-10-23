"use client";

import React, { useEffect, useState, use, Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  Info,
  Camera,
  Search as SearchIcon,
  GitCompare,
  RotateCw,
  WifiOff,
} from "lucide-react";
import { getProduct, ApiError } from "@/lib/api-client";
import { Product } from "@/lib/schemas/product";
import { getLabelProduct } from "@/lib/label-store";
import {
  getHistoryItem,
  saveHistoryItem,
  updateHistoryExplanation,
} from "@/lib/history-store";
import { isFeatureEnabled } from "@/lib/features";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { MissingChip } from "@/components/MissingChip";
import { DataRow } from "@/components/DataRow";
import { DisabledAction } from "@/components/DisabledAction";
import { Disclaimer } from "@/components/Disclaimer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AiExplanationSection } from "@/components/product/AiExplanationSection";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

// Helper: parse ingredient text into individual items
function parseIngredientItems(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim().replace(/[()\[\]]/g, "").trim())
    .filter((s) => s.length > 0 && s.length < 80);
}

// Color-code ingredient pill by type
function getIngredientPillStyle(ingredient: string): string {
  const lower = ingredient.toLowerCase();
  if (/sugar|syrup|fructose|glucose|dextrose|maltose|sucrose|honey|molasses/.test(lower)) {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  if (/salt|sodium|natrium/.test(lower)) {
    return "bg-orange-50 text-orange-800 border-orange-200";
  }
  if (/oil|fat|butter|cream|lard|ghee/.test(lower)) {
    return "bg-yellow-50 text-yellow-800 border-yellow-200";
  }
  if (/e\d{3}|additive|preservative|artificial|colour|color|flavor|flavour/.test(lower)) {
    return "bg-purple-50 text-purple-800 border-purple-200";
  }
  if (/wheat|flour|grain|corn|rice|oat|barley|rye|starch/.test(lower)) {
    return "bg-stone-50 text-stone-700 border-stone-200";
  }
  if (/milk|dairy|whey|casein|lactose/.test(lower)) {
    return "bg-sky-50 text-sky-800 border-sky-200";
  }
  if (/protein|soy|pea|legume/.test(lower)) {
    return "bg-green-50 text-green-800 border-green-200";
  }
  return "bg-[#F5F2EA] text-[#1B2A22] border-[#E4DEC3]";
}

export interface ProductDetailViewProps {
  refParam: string;
}

export function ProductDetailView({ refParam }: ProductDetailViewProps) {
  const isBarcodeRef = /^bc-\d+$/.test(refParam);
  const isLabelRef = /^lb-[a-z0-9-]+$/i.test(refParam);
  const barcode = isBarcodeRef ? refParam.replace("bc-", "") : "";

  // Check history first
  const [historyItem, setHistoryItem] = useState(() => {
    if (typeof window !== "undefined") {
      return getHistoryItem(refParam);
    }
    return null;
  });

  const [isFromHistory, setIsFromHistory] = useState<boolean>(() => Boolean(historyItem));
  const [product, setProduct] = useState<Product | null>(() => {
    if (historyItem) return historyItem.snapshot;
    if (isLabelRef && typeof window !== "undefined") {
      return getLabelProduct(refParam);
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (historyItem || isLabelRef) return false;
    return Boolean(isBarcodeRef);
  });
  const [isSlow, setIsSlow] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  const [labelExpired] = useState<boolean>(() => {
    if (isLabelRef && typeof window !== "undefined") {
      return !historyItem && !getLabelProduct(refParam);
    }
    return false;
  });

  const [showOffComputed, setShowOffComputed] = useState<boolean>(false);
  const [showAllIngredients, setShowAllIngredients] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  usePageTitle(product?.name || "Product Details");

  // Share active product with unified Nutri AI Chatbot
  useEffect(() => {
    if (product && typeof window !== "undefined") {
      const summary = {
        name: product.name,
        brand: product.brand,
        ingredients: product.ingredients?.raw_text || "",
        nutrition: product.nutrition?.values || {},
        basis: product.nutrition?.basis || "per 100g",
        allergens: product.allergens?.declared || [],
      };
      (window as any).__INGRIVO_CURRENT_PRODUCT__ = summary;
      window.dispatchEvent(
        new CustomEvent("ingrivo-current-product", { detail: summary })
      );
    }
    return () => {
      if (typeof window !== "undefined") {
        (window as any).__INGRIVO_CURRENT_PRODUCT__ = null;
        window.dispatchEvent(
          new CustomEvent("ingrivo-current-product", { detail: null })
        );
      }
    };
  }, [product]);

  // Monitor network online/offline state
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Save label product to history if not yet stored
  useEffect(() => {
    if (isLabelRef && product && !historyItem) {
      saveHistoryItem({
        ref: refParam,
        kind: "label",
        title: product.name,
        brand: product.brand,
        snapshot: product,
      });
    }
  }, [isLabelRef, product, historyItem, refParam]);

  // Initial fetch for barcode product when NOT loaded from history
  useEffect(() => {
    if (isLabelRef || isFromHistory || product || !isBarcodeRef) {
      return;
    }

    let isMounted = true;

    getProduct(barcode, {
      onSlow: () => {
        if (isMounted) setIsSlow(true);
      },
    })
      .then((data) => {
        if (isMounted) {
          setProduct(data);
          setLoading(false);
          const saved = saveHistoryItem({
            ref: refParam,
            kind: "barcode",
            title: data.name,
            brand: data.brand,
            snapshot: data,
          });
          setHistoryItem(saved);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err);
          } else {
            setError(
              new ApiError(
                err instanceof Error ? err.message : "An unexpected error occurred.",
                "UNKNOWN_ERROR",
                500
              )
            );
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [barcode, isBarcodeRef, isFromHistory, isLabelRef, product, refParam]);

  // Explicit refresh from source action
  const handleRefreshFromSource = async () => {
    if (!isBarcodeRef) return;
    setLoading(true);
    setIsSlow(false);
    setError(null);
    try {
      const data = await getProduct(barcode, {
        onSlow: () => setIsSlow(true),
      });
      setProduct(data);
      setIsFromHistory(false);
      const saved = saveHistoryItem({
        ref: refParam,
        kind: "barcode",
        title: data.name,
        brand: data.brand,
        snapshot: data,
      });
      setHistoryItem(saved);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(
          new ApiError(
            err instanceof Error ? err.message : "An unexpected error occurred.",
            "UNKNOWN_ERROR",
            500
          )
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // 1. Invalid Reference Format
  if (!isBarcodeRef && !isLabelRef) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-[#5E6B63]">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-[#1B2A22]">Invalid Product Reference</h1>
        <p className="text-sm text-[#5E6B63]">
          Expected a product barcode (<code>bc-&lt;barcode&gt;</code>) or label reference (<code>lb-&lt;uuid&gt;</code>).
        </p>
        <div>
          <Link href="/scan" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go to barcode entry
          </Link>
        </div>
      </div>
    );
  }

  // 1b. Label Product Expired or Not Found in Session
  if (isLabelRef && labelExpired) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-[#1B2A22]">Label Data Unavailable</h1>
        <p className="text-sm text-[#5E6B63] max-w-md mx-auto">
          This label result is only kept in this browser tab and is no longer available in local history. You can capture or upload the label photo again.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/label" className={buttonVariants({ variant: "default" })}>
            <Camera className="h-4 w-4 mr-2" />
            Scan label photo again
          </Link>
          <Link href="/scan" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go to barcode scanner
          </Link>
        </div>
      </div>
    );
  }

  // 2. Loading State with Skeleton & Server Wakeup Message
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 space-y-6">
        {isSlow && (
          <div
            role="status"
            className="flex items-center gap-3 p-3.5 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-900"
          >
            <Clock className="h-4 w-4 shrink-0 text-amber-700 animate-spin" />
            <span>
              Waking up the server or contacting Open Food Facts, this may take a few moments...
            </span>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-28 bg-[#EFECE4]" />
        </div>

        <Card className="border border-[#E4DEC3] bg-white">
          <CardContent className="pt-6 space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <Skeleton className="h-44 w-44 rounded-xl bg-[#EFECE4] shrink-0" />
              <div className="space-y-3 flex-1">
                <Skeleton className="h-8 w-3/4 bg-[#EFECE4]" />
                <Skeleton className="h-5 w-1/3 bg-[#EFECE4]" />
                <Skeleton className="h-4 w-1/4 bg-[#EFECE4]" />
              </div>
            </div>
            <Skeleton className="h-24 w-full bg-[#EFECE4]" />
            <Skeleton className="h-36 w-full bg-[#EFECE4]" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Error States for Barcode Lookup
  if (error || !product) {
    const isNotFound = error?.code === "PRODUCT_NOT_FOUND" || error?.status === 404;
    const isRateLimited = error?.code === "UPSTREAM_RATE_LIMITED" || error?.code === "RATE_LIMITED";
    const isTimeout = error?.code === "UPSTREAM_TIMEOUT" || error?.status === 504;

    return (
      <div className="max-w-xl mx-auto py-14 px-4 sm:px-6 space-y-8">
        <Card className="border border-[#E4DEC3] bg-white shadow-xs">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-[#5E6B63]">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl font-bold text-[#1B2A22]">
              {isNotFound
                ? "Product Not Found"
                : isRateLimited
                ? "Rate Limit Reached"
                : isTimeout
                ? "Server Connection Timed Out"
                : "Unable to Load Product"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p className="text-sm text-[#5E6B63] leading-relaxed">
              {isNotFound
                ? `Barcode ${barcode} was not found in Open Food Facts. You can check the digits or use one of the alternative options below.`
                : isRateLimited
                ? "Too many requests were sent to Open Food Facts. Please wait a minute and retry."
                : isTimeout
                ? "Open Food Facts took too long to reply. Please check your internet connection or try again shortly."
                : error?.message || "An unexpected error occurred while communicating with the service."}
            </p>

            {isNotFound && (
              <div className="space-y-3 pt-2 text-left">
                <p className="text-xs font-semibold text-[#1B2A22] uppercase tracking-wider">
                  Available Alternatives
                </p>
                <div className="flex flex-col gap-2">
                  {isFeatureEnabled("search") ? (
                    <Link
                      href="/search"
                      className={buttonVariants({
                        variant: "secondary",
                        className: "justify-start gap-2 h-11",
                      })}
                    >
                      <SearchIcon className="h-4 w-4 text-[#1E5B45]" />
                      <span>Search product by title</span>
                    </Link>
                  ) : (
                    <DisabledAction
                      label="Search product by title"
                      explanation="OFF Search integration planned for Phase 5"
                      icon={<SearchIcon className="h-4 w-4" />}
                      variant="secondary"
                    />
                  )}

                  {isFeatureEnabled("label") ? (
                    <Link
                      href="/label"
                      className={buttonVariants({
                        variant: "outline",
                        className: "justify-start gap-2 h-11",
                      })}
                    >
                      <Camera className="h-4 w-4 text-[#1E5B45]" />
                      <span>Capture label photo (OCR)</span>
                    </Link>
                  ) : (
                    <DisabledAction
                      label="Capture label photo (OCR)"
                      explanation="On-device OCR parsing planned for Phase 6"
                      icon={<Camera className="h-4 w-4" />}
                      variant="outline"
                    />
                  )}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-center gap-3">
              <Link href="/scan" className={buttonVariants({ variant: "outline" })}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Try another barcode
              </Link>
              {!isNotFound && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className={buttonVariants({ variant: "default" })}
                >
                  Retry request
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4. Product Found View (Barcode or Label Product)
  const isLabelProduct = product.kind === "label_product";

  const basisLabel =
    product.nutrition.basis === "per_100g"
      ? "per 100 g"
      : product.nutrition.basis === "per_100ml"
      ? "per 100 ml"
      : product.nutrition.basis === "per_serving"
      ? `per serving (${product.nutrition.serving_size || "size unstated"})`
      : "basis not stated in source";

  const isUnknownBasis = product.nutrition.basis === "unknown";

  const getBadgeForField = (provenance: string) => {
    if (provenance === "user_corrected") {
      return <ProvenanceBadge variant="user_corrected" customLabel="edited by you" />;
    }
    if (isLabelProduct || provenance === "ocr") {
      return <ProvenanceBadge variant="ocr" customLabel="From your label" />;
    }
    return <ProvenanceBadge variant="source" />;
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href={isLabelProduct ? "/label" : "/scan"}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5E6B63] hover:text-[#1E5B45] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isLabelProduct ? "Back to label scanning" : "Back to barcode entry"}
        </Link>
      </div>

      {/* Offline Status Notice */}
      {!isOnline && (
        <div
          role="status"
          className="p-3 bg-stone-100 border border-stone-300 rounded-xl text-xs text-stone-800 font-medium flex items-center gap-2"
        >
          <WifiOff className="h-4 w-4 text-stone-600 shrink-0" aria-hidden="true" />
          <span>You are currently offline. Viewing local snapshot data.</span>
        </div>
      )}

      {/* Reopened from History Banner */}
      {isFromHistory && product && (
        <div
          role="status"
          className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-800 shrink-0" aria-hidden="true" />
            <span>
              Viewing saved snapshot
              {(product.source?.retrieved_at || historyItem?.savedAt)
                ? ` from ${new Date(product.source?.retrieved_at || historyItem?.savedAt || "").toLocaleDateString()}`
                : ""}
              .
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefreshFromSource}
            className="h-8 text-xs font-semibold gap-1.5 border-amber-300 bg-white hover:bg-amber-100 self-start sm:self-auto"
          >
            <RotateCw className="h-3 w-3" aria-hidden="true" />
            <span>Refresh from source</span>
          </Button>
        </div>
      )}

      {/* Label Product Banner Notice */}
      {isLabelProduct && (
        <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 font-medium flex items-center gap-2.5">
          <Camera className="h-4 w-4 text-sky-700 shrink-0" aria-hidden="true" />
          <span>
            Based on text you reviewed from a photo. Not uploaded or stored on any server.
          </span>
        </div>
      )}

      {/* 1. Overview */}
      <ScrollReveal blur={10} yOffset={20}>
        <Card className="border border-[#E4DEC3] bg-white shadow-xs">
          <CardContent className="p-3.5 sm:p-6">
            <div className="flex flex-row gap-3.5 sm:gap-6 items-start">
              {product.image_url ? (
                <div className="relative w-24 h-24 sm:w-44 sm:h-44 bg-[#FBF8F2] rounded-xl border border-[#E4DEC3] overflow-hidden shrink-0 flex items-center justify-center p-1.5 sm:p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.image_url}
                    alt={product.name ? `Package photo for ${product.name}` : "Packaged food product photo"}
                    width={176}
                    height={176}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div
                  role="img"
                  aria-label="No product image available"
                  className="w-24 h-24 sm:w-44 sm:h-44 bg-stone-100 rounded-xl border border-stone-200 flex flex-col items-center justify-center shrink-0 text-[#5E6B63] p-2 sm:p-4 text-center"
                >
                  <MissingChip label="No photo" />
                  <span className="text-[10px] sm:text-[11px] text-[#5E6B63] mt-1.5 hidden sm:block">No product image available</span>
                </div>
              )}

              <div className="space-y-1.5 sm:space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {getBadgeForField(product.name_provenance)}
                  {product.brand && (
                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#5E6B63] truncate max-w-[160px] sm:max-w-none">
                      {product.brand}
                    </span>
                  )}
                  {product.brand_provenance === "user_corrected" && (
                    <ProvenanceBadge variant="user_corrected" customLabel="edited by you" />
                  )}
                </div>
                <h1 className="text-base sm:text-2xl md:text-3xl font-extrabold text-[#1B2A22] leading-tight">
                  {product.name || "Unnamed Product"}
                </h1>
                {product.quantity && (
                  <p className="text-[11px] sm:text-xs text-[#5E6B63]">
                    Quantity: <span className="font-medium text-[#1B2A22]">{product.quantity}</span>
                  </p>
                )}
                {product.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {product.categories.slice(0, 4).map((cat, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[11px] font-normal bg-[#FBF8F2] text-[#5E6B63] border border-[#E4DEC3]"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
                {isFeatureEnabled("compare") && (
                  <div className="pt-2">
                    <Link
                      href={`/compare?a=${encodeURIComponent(refParam)}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                        className: "gap-1.5 text-xs text-[#1E5B45] border-[#1E5B45]/30 hover:bg-[#1E5B45]/10",
                      })}
                    >
                      <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Compare with another product</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* 2. Ingredients — Enhanced Display */}
      <ScrollReveal blur={10} yOffset={24}>
        <Card className="border border-[#E4DEC3] bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-[#E4DEC3]/60 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-[#1B2A22]">
              Ingredients
            </CardTitle>
            {getBadgeForField(product.ingredients.provenance)}
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {product.ingredients.raw_text ? (
              <div className="space-y-3">
                {/* Full raw text */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-[#5E6B63] uppercase tracking-wider">
                    Full ingredient list
                  </p>
                  <p className="text-sm text-[#1B2A22] leading-relaxed bg-[#FBF8F2] p-3.5 rounded-xl border border-[#E4DEC3] break-words">
                    {product.ingredients.raw_text.length > 300 && !showAllIngredients
                      ? `${product.ingredients.raw_text.slice(0, 300)}...`
                      : product.ingredients.raw_text}
                  </p>
                  {product.ingredients.raw_text.length > 300 && (
                    <button
                      type="button"
                      onClick={() => setShowAllIngredients(!showAllIngredients)}
                      aria-expanded={showAllIngredients}
                      className="text-xs font-semibold text-[#1E5B45] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5B45] rounded py-1 px-1"
                    >
                      {showAllIngredients ? "Show less" : "Show more ingredients"}
                    </button>
                  )}
                </div>

                {/* Color-coded ingredient pills */}
                {(() => {
                  const parsedItems = parseIngredientItems(product.ingredients.raw_text);
                  if (parsedItems.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-[#5E6B63] uppercase tracking-wider">
                          Ingredients breakdown ({parsedItems.length})
                        </p>
                        {/* Legend */}
                        <div className="flex flex-wrap gap-1 justify-end">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">🍬 Sugar</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">🧪 Additive</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">🧂 Salt</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {parsedItems.map((item, i) => (
                          <span
                            key={i}
                            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all hover:scale-105 ${getIngredientPillStyle(item)}`}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MissingChip label="No ingredients listed in record" />
              </div>
            )}
            {product.ingredients.items.length > 0 && !product.ingredients.raw_text && (
              <div className="pt-2">
                <span className="text-xs font-semibold text-[#5E6B63] block mb-1.5">
                  Structured components ({product.ingredients.items.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {product.ingredients.items.map((it, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getIngredientPillStyle(it)}`}
                    >
                      {it}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* 3. Nutrition Table */}
      <ScrollReveal blur={10} yOffset={24}>
        <Card className="border border-[#E4DEC3] bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-[#E4DEC3]/60 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-[#1B2A22]">
                Nutrition Values
              </CardTitle>
              <span className="text-xs font-semibold text-[#1E5B45]">
                Basis: {basisLabel}
              </span>
            </div>
            {getBadgeForField(product.nutrition.provenance)}
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {isUnknownBasis && (
              <div className="flex items-center gap-2 p-2.5 rounded-md border border-amber-300 bg-amber-50 text-xs text-amber-900">
                <Info className="h-4 w-4 shrink-0 text-amber-700" />
                <span>
                  Note: Nutrition basis is not specified. Amounts may be per 100g or per serving.
                </span>
              </div>
            )}

            <div
              aria-label={`Nutrition values (${basisLabel})`}
              className="rounded-lg border border-[#E4DEC3]/80 bg-[#FBF8F2]/60 overflow-hidden divide-y divide-[#E4DEC3]/60"
            >
              <DataRow
                label="Energy"
                value={
                  product.nutrition.values.energy_kcal !== null
                    ? `${product.nutrition.values.energy_kcal} kcal${
                        product.nutrition.values.energy_kj !== null
                          ? ` (${product.nutrition.values.energy_kj} kJ)`
                          : ""
                      }`
                    : null
                }
                provenance={isLabelProduct ? "ocr" : "source"}
              />
              <DataRow
                label="Total Fat"
                value={product.nutrition.values.fat}
                unit="g"
                provenance={isLabelProduct ? "ocr" : "source"}
              />
              <DataRow
                label="Saturated Fat"
                value={product.nutrition.values.saturated_fat}
                unit="g"
                provenance={isLabelProduct ? "ocr" : "source"}
              />
              <DataRow
                label="Carbohydrates"
                value={product.nutrition.values.carbohydrates}
                unit="g"
                provenance={isLabelProduct ? "ocr" : "source"}
              />
              <DataRow
                label="Total Sugars"
                value={product.nutrition.values.sugars}
                unit="g"
                provenance={isLabelProduct ? "ocr" : "source"}
              />
              {product.nutrition.values.added_sugars !== undefined &&
                product.nutrition.values.added_sugars !== null && (
                  <DataRow
                    label="Added Sugars"
                    value={product.nutrition.values.added_sugars}
                    unit="g"
                    provenance={isLabelProduct ? "ocr" : "source"}
                  />
                )}
              <DataRow
                label="Dietary Fibre"
                value={product.nutrition.values.fibre}
                unit="g"
                provenance={isLabelProduct ? "ocr" : "source"}
              />
              <DataRow
                label="Protein"
                value={product.nutrition.values.protein}
                unit="g"
                provenance={isLabelProduct ? "ocr" : "source"}
              />
              <DataRow
                label="Salt"
                value={product.nutrition.values.salt}
                unit="g"
                provenance={isLabelProduct ? "ocr" : "source"}
              />
              <DataRow
                label="Sodium"
                value={product.nutrition.values.sodium}
                unit="g"
                provenance={isLabelProduct ? "ocr" : "source"}
              />
            </div>
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* 4. Allergens */}
      <ScrollReveal blur={10} yOffset={24}>
        <Card className="border border-[#E4DEC3] bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-[#E4DEC3]/60 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-[#1B2A22]">
              Allergen Information
            </CardTitle>
            {getBadgeForField(product.allergens.provenance)}
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {product.allergens.declared.length > 0 ? (
              <div>
                <span className="text-xs font-semibold text-[#1B2A22] block mb-1">
                  Declared Allergens:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {product.allergens.declared.map((a, i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-medium"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#5E6B63] bg-[#FBF8F2] p-3 rounded border border-[#E4DEC3]">
                No allergens declared. Always inspect packaging for manufacturing alerts.
              </p>
            )}

            {product.allergens.traces.length > 0 && (
              <div className="pt-2">
                <span className="text-xs font-semibold text-[#5E6B63] block mb-1">
                  May contain traces of:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {product.allergens.traces.map((t, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* 5. Data Completeness */}
      <ScrollReveal blur={10} yOffset={24}>
        <Card className="border border-[#E4DEC3] bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-[#E4DEC3]/60">
            <CardTitle className="text-lg font-bold text-[#1B2A22]">
              Data Completeness
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#1B2A22]">
                Completeness Score
              </span>
              <span className="text-sm font-bold text-[#1E5B45]">
                {Math.round(product.completeness.score * 100)}%
              </span>
            </div>
            <div className="w-full bg-[#EFECE4] rounded-full h-2">
              <div
                className="bg-[#1E5B45] h-2 rounded-full transition-all"
                style={{ width: `${Math.round(product.completeness.score * 100)}%` }}
              />
            </div>
            {product.completeness.missing.length > 0 ? (
              <div className="pt-2">
                <span className="text-xs font-semibold text-[#5E6B63] block mb-1">
                  Missing from record ({product.completeness.missing.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {product.completeness.missing.map((m, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded bg-stone-100 text-[#5E6B63] border border-stone-200"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#1E5B45]">
                All core fields are documented.
              </p>
            )}
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* AI Explanation Section (Phase 7: Explicit user-initiated click only) */}
      {isFeatureEnabled("ai") && (
        <ScrollReveal blur={12} yOffset={28}>
          <AiExplanationSection
            product={product}
            initialExplanation={historyItem?.explanation}
            onExplanationGenerated={(exp) => updateHistoryExplanation(refParam, exp)}
          />
        </ScrollReveal>
      )}

      {/* 6. Open Food Facts Computed Fields (Collapsed) - Barcode products only */}
      {!isLabelProduct && product.source_computed && (
        <ScrollReveal blur={10} yOffset={24}>
          <Card className="border border-[#E4DEC3] bg-[#FBF8F2] shadow-xs">
            <CardContent className="pt-4">
              <button
                type="button"
                onClick={() => setShowOffComputed(!showOffComputed)}
                className="flex items-center justify-between w-full text-left text-xs font-semibold text-[#5E6B63] hover:text-[#1B2A22]"
                aria-expanded={showOffComputed}
              >
                <span>Computed by Open Food Facts, not by Ingrivo</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    showOffComputed ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showOffComputed && (
                <div className="pt-4 mt-3 border-t border-[#E4DEC3] space-y-2 text-xs text-[#5E6B63]">
                  <p>
                    <strong>Nutri-Score: </strong>
                    {product.source_computed.nutriscore
                      ? product.source_computed.nutriscore.toUpperCase()
                      : "Not computed"}
                  </p>
                  <p>
                    <strong>NOVA Group: </strong>
                    {product.source_computed.nova_group !== null
                      ? `Group ${product.source_computed.nova_group}`
                      : "Not computed"}
                  </p>
                  {product.source_computed.additive_tags.length > 0 && (
                    <div>
                      <strong>Additives tagged by OFF: </strong>
                      {product.source_computed.additive_tags.join(", ")}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </ScrollReveal>
      )}

      {/* 7. Source Attribution (Barcode products only) OR Legal Disclaimer only (Label products) */}
      {!isLabelProduct && product.source ? (
        <div className="rounded-xl border border-[#E4DEC3] bg-[#EFECE4]/50 p-4 space-y-3 text-xs text-[#5E6B63]">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#1B2A22]">Data Source Attribution</span>
            {product.source.product_url && (
              <a
                href={product.source.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#1E5B45] hover:underline"
              >
                View on Open Food Facts
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p className="leading-relaxed">
            Product data retrieved from Open Food Facts under the Open Database License (ODbL).
            Last modified in source: {product.source.last_modified || "Not recorded"}.
            Product images are licensed under Creative Commons Attribution-ShareAlike (CC BY-SA).
          </p>
          <p className="leading-relaxed text-[#1B2A22]">
            Open Food Facts is community-contributed; records may be incomplete or wrong. Always check physical package labels.
          </p>
          <Disclaimer />
        </div>
      ) : (
        <div className="rounded-xl border border-[#E4DEC3] bg-[#EFECE4]/50 p-4 space-y-3 text-xs text-[#5E6B63]">
          <Disclaimer />
        </div>
      )}
    </div>
  );
}

function ProductPageContent({ paramsPromise }: { paramsPromise: Promise<{ ref: string }> }) {
  const resolved = use(paramsPromise);
  return <ProductDetailView refParam={resolved.ref} />;
}

interface PageProps {
  params: Promise<{ ref: string }>;
}

export default function ProductPage({ params }: PageProps) {
  return (
    <AuthGuard
      featureName="Food Product Facts & Ingrivo AI"
      description="Sign in to view verified ingredient breakdowns, ultra-processed food indicators, allergen suitability, and chat live with Ingrivo AI."
    >
      <Suspense
        fallback={
          <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 space-y-6">
            <Skeleton className="h-8 w-48 bg-[#EFECE4]" />
            <Skeleton className="h-64 w-full bg-[#EFECE4] rounded-xl" />
          </div>
        }
      >
        <ProductPageContent paramsPromise={params} />
      </Suspense>
    </AuthGuard>
  );
}
