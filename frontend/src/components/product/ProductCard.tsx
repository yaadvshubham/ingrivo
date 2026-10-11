import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ImageOff, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { ProductSummary } from "@/lib/schemas/search";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { Card, CardContent } from "@/components/ui/card";

export interface ProductCardProps {
  product: ProductSummary;
}

export function ProductCard({ product }: ProductCardProps) {
  const nutritionLabel =
    product.nutrition_availability === "most"
      ? "Nutrition: most available"
      : product.nutrition_availability === "partial"
      ? "Nutrition: partial"
      : "Nutrition: none available";

  const nutritionColor =
    product.nutrition_availability === "most"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : product.nutrition_availability === "partial"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-stone-100 text-[#5E6B63] border-stone-200";

  return (
    <Card className="border border-[#E4DEC3] bg-white shadow-xs hover:border-[#1E5B45]/50 transition-all duration-150 overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* Product Thumbnail or Clear Non-photo Placeholder */}
          {product.image_url ? (
            <div className="relative w-full sm:w-28 h-28 bg-[#FBF8F2] rounded-lg border border-[#E4DEC3] overflow-hidden shrink-0 flex items-center justify-center">
              <Image
                src={product.image_url}
                alt={product.name ? `Packaged photo of ${product.name}` : "Product package photo"}
                fill
                className="object-contain p-1"
                unoptimized
              />
            </div>
          ) : (
            <div
              data-testid="no-image-placeholder"
              className="w-full sm:w-28 h-28 bg-[#F5F2EB] rounded-lg border border-[#E4DEC3] flex flex-col items-center justify-center shrink-0 text-[#5E6B63] p-2 text-center"
            >
              <ImageOff className="h-6 w-6 text-[#8F9E95] mb-1" aria-hidden="true" />
              <span className="text-[11px] text-[#5E6B63] font-medium leading-tight">
                No photo in database
              </span>
            </div>
          )}

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <ProvenanceBadge variant="source" />
              {product.brand && (
                <span
                  data-testid="product-card-brand"
                  className="text-xs font-semibold uppercase tracking-wider text-[#5E6B63] truncate max-w-[200px]"
                >
                  {product.brand}
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-bold text-[#1B2A22] leading-snug">
              <Link
                href={`/product/${product.ref}`}
                className="hover:text-[#1E5B45] hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E5B45] rounded"
              >
                {product.name || "Unnamed Product"}
              </Link>
            </h3>

            {/* Categories (max 2) */}
            {product.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {product.categories.slice(0, 2).map((cat, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded text-[11px] font-normal bg-[#FBF8F2] text-[#5E6B63] border border-[#E4DEC3]"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Status Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {/* Ingredients chip */}
              <span
                data-testid="ingredients-chip"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium ${
                  product.has_ingredients
                    ? "bg-emerald-50 text-[#1E5B45] border-emerald-200"
                    : "bg-stone-100 text-[#5E6B63] border-stone-200"
                }`}
              >
                <FileText className="h-3 w-3" aria-hidden="true" />
                {product.has_ingredients ? "Ingredients listed" : "No ingredients listed"}
              </span>

              {/* Nutrition availability chip */}
              <span
                data-testid="nutrition-chip"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium ${nutritionColor}`}
              >
                {product.nutrition_availability === "none" ? (
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                )}
                {nutritionLabel}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
