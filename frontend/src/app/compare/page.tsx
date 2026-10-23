"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GitCompare,
  AlertCircle,
  Clock,
  Scale,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductSlotPicker } from "@/components/compare/ProductSlotPicker";
import { CompareTable } from "@/components/compare/CompareTable";
import { CompareAiSection } from "@/components/compare/CompareAiSection";
import { compareProducts, ApiError } from "@/lib/api-client";
import { CompareRequestSource, CompareResponse } from "@/lib/schemas/compare";
import { getLabelProduct } from "@/lib/label-store";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

function parseRefToSource(ref: string): CompareRequestSource {
  if (ref.startsWith("bc-")) {
    return { type: "barcode", barcode: ref.replace("bc-", "") };
  }
  if (ref.startsWith("lb-")) {
    const labelProd = getLabelProduct(ref);
    if (!labelProd) {
      throw new Error(`Session label product ${ref} has expired or is not found in this browser.`);
    }
    return {
      type: "label",
      evidence: {
        ref: labelProd.ref,
        kind: "label_product",
        name: labelProd.name,
        name_provenance: labelProd.name_provenance,
        brand: labelProd.brand,
        brand_provenance: labelProd.brand_provenance,
        ingredients_text: labelProd.ingredients.raw_text,
        ingredients_provenance: labelProd.ingredients.provenance,
        allergens_declared: labelProd.allergens.declared,
        allergens_traces: labelProd.allergens.traces,
        allergens_provenance: labelProd.allergens.provenance,
        nutrition_basis: labelProd.nutrition.basis,
        serving_size: labelProd.nutrition.serving_size,
        nutrient_rows: Object.entries(labelProd.nutrition.values)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([k, v]) => ({
            name: k,
            value: v as number,
            unit: k.includes("energy") ? (k.includes("kj") ? "kJ" : "kcal") : "g",
          })),
        nutrition_provenance: labelProd.nutrition.provenance,
        user_confirmed: true,
      },
    };
  }
  // Default fallback assumes barcode
  return { type: "barcode", barcode: ref };
}

export function ComparePageContent() {
  usePageTitle("Product Comparison");
  const router = useRouter();
  const searchParams = useSearchParams();

  const refA = searchParams.get("a");
  const refB = searchParams.get("b");

  const [comparisonData, setComparisonData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  const isSameRef = Boolean(refA && refB && refA === refB);
  const hasBoth = Boolean(refA && refB && !isSameRef);

  useEffect(() => {
    if (!refA || !refB || refA === refB) {
      return;
    }

    let isMounted = true;
    let sourceA: CompareRequestSource;
    let sourceB: CompareRequestSource;

    try {
      sourceA = parseRefToSource(refA);
      sourceB = parseRefToSource(refB);
    } catch (err: unknown) {
      queueMicrotask(() => {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });
      return;
    }

    queueMicrotask(() => {
      if (isMounted) {
        setLoading(true);
        setIsSlow(false);
        setError(null);
      }
    });

    compareProducts(
      { a: sourceA, b: sourceB, include_ai_explanation: false },
      {
        onSlow: () => {
          if (isMounted) setIsSlow(true);
        },
      }
    )
      .then((res) => {
        if (isMounted) {
          setComparisonData(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof ApiError || err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [refA, refB]);

  const updateUrl = (newA: string | null, newB: string | null) => {
    const params = new URLSearchParams();
    if (newA) params.set("a", newA);
    if (newB) params.set("b", newB);
    const query = params.toString();
    router.push(query ? `/compare?${query}` : "/compare");
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Header */}
      <ScrollReveal blur={10} yOffset={20}>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1E5B45]/20 bg-[#1E5B45]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#1E5B45]">
            <Scale className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Objective Comparison</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1B2A22]">
            Product Comparison
          </h1>
          <p className="text-sm text-[#5E6B63] max-w-2xl leading-relaxed">
            Compare two packaged food products with deterministic, honest math.
            Missing fields are explicitly highlighted, never smoothed over. Zero moral verdicts.
          </p>
        </div>
      </ScrollReveal>

      {/* Product Slots Picker Row */}
      <ScrollReveal delay={100} blur={10} yOffset={20}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProductSlotPicker
            slotLabel="Product A"
            currentRef={refA}
            summary={comparisonData?.a}
            onSelect={(newRef) => updateUrl(newRef, refB)}
            onClear={() => updateUrl(null, refB)}
          />
          <ProductSlotPicker
            slotLabel="Product B"
            currentRef={refB}
            summary={comparisonData?.b}
            onSelect={(newRef) => updateUrl(refA, newRef)}
            onClear={() => updateUrl(refA, null)}
          />
        </div>
      </ScrollReveal>

      {/* Same Ref Warning */}
      {isSameRef && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-1"
        >
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="h-4 w-4 text-amber-800" />
            <span>Identical Product Selected in Both Slots</span>
          </div>
          <p>
            Both comparison slots contain the same product. Select a different product for slot B to compare differences.
          </p>
        </div>
      )}

      {/* Unselected Slots Prompt */}
      {(!refA || !refB) && (
        <ScrollReveal delay={150} blur={10} yOffset={20}>
          <div className="rounded-xl border border-dashed border-[#E4DEC3] bg-[#FBF8F2]/60 p-8 text-center space-y-2">
            <GitCompare className="h-8 w-8 text-[#5E6B63] mx-auto opacity-60" aria-hidden="true" />
            <h3 className="text-base font-bold text-[#1B2A22]">
              Select Two Products to Compare
            </h3>
            <p className="text-xs text-[#5E6B63] max-w-md mx-auto">
              Choose products using barcode entry, camera scanning, text search, or recently reviewed photo labels from this session.
            </p>
          </div>
        </ScrollReveal>
      )}

      {/* Loading State */}
      {hasBoth && loading && (
        <div className="space-y-6">
          {isSlow && (
            <div
              role="status"
              className="flex items-center gap-3 p-3.5 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-900"
            >
              <Clock className="h-4 w-4 shrink-0 text-amber-700 animate-spin" />
              <span>
                Waking up the server or loading products from Open Food Facts, please wait...
              </span>
            </div>
          )}

          <div className="rounded-xl border border-[#E4DEC3] bg-white p-6 space-y-4">
            <Skeleton className="h-6 w-1/3 bg-[#EFECE4]" />
            <Skeleton className="h-32 w-full bg-[#EFECE4]" />
            <Skeleton className="h-48 w-full bg-[#EFECE4]" />
          </div>
        </div>
      )}

      {/* Error State */}
      {hasBoth && error && !loading && (
        <Card className="border border-red-200 bg-red-50/50 p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-red-900">
            <AlertCircle className="h-4 w-4 text-red-700" />
            <span>Unable to Compare Products</span>
          </div>
          <p className="text-xs text-red-800 leading-relaxed">
            {error instanceof ApiError
              ? error.message
              : error.message || "An error occurred while loading the comparison."}
          </p>
        </Card>
      )}

      {/* Comparison View */}
      {hasBoth && comparisonData && !loading && !error && (
        <ScrollReveal blur={12} yOffset={24}>
          <div className="space-y-10">
            <CompareTable data={comparisonData} />

            {/* AI Narrative Section */}
            <CompareAiSection
              refA={refA!}
              refB={refB!}
              requestPayload={{
                a: parseRefToSource(refA!),
                b: parseRefToSource(refB!),
              }}
              initialAi={comparisonData.ai}
              initialStatus={comparisonData.ai_status}
            />
          </div>
        </ScrollReveal>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-12 px-4 text-center text-sm text-[#5E6B63]">Loading comparison...</div>}>
      <AuthGuard
        featureName="Side-by-Side Food Comparison"
        description="Sign in to compare products, align nutritional bases, and view AI-guided comparison narratives."
      >
        <ComparePageContent />
      </AuthGuard>
    </Suspense>
  );
}
