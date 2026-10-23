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
    <Card className="glass-card glass-card-hover rounded-xl sm:rounded-2xl border border-[#E4DEC3] overflow-hidden group">
      <CardContent className="p-3 sm:p-5">
        <div className="flex flex-row gap-3 sm:gap-4 items-start">
          {/* Product Thumbnail or Clear Non-photo Placeholder */}
          {product.image_url ? (
            <div className="relative w-20 h-20 sm:w-28 sm:h-28 bg-[#FBF8F2] rounded-lg sm:rounded-xl border border-[#E4DEC3] overflow-hidden shrink-0 flex items-center justify-center group-hover:border-[#1E5B45]/40 transition-colors">
              <Image
                src={product.image_url}
                alt={product.name ? `Packaged photo of ${product.name}` : "Product package photo"}
                fill
                className="object-contain p-1 sm:p-1.5 transition-transform duration-300 group-hover:scale-105"
                unoptimized
              />
            </div>
          ) : (
            <div
              data-testid="no-image-placeholder"
              className="w-20 h-20 sm:w-28 sm:h-28 bg-[#F5F2EB] rounded-lg border border-[#E4DEC3] flex flex-col items-center justify-center shrink-0 text-[#5E6B63] p-1.5 sm:p-2 text-center"
            >
              <ImageOff className="h-4 w-4 sm:h-6 sm:w-6 text-[#8F9E95] mb-0.5 sm:mb-1" aria-hidden="true" />
              <span className="text-[9px] sm:text-[11px] text-[#5E6B63] font-medium leading-tight">
                No photo in database
              </span>
            </div>
          )}

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-1 sm:space-y-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <ProvenanceBadge variant="source" />
              {product.brand && (
                <span
                  data-testid="product-card-brand"
                  className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#5E6B63] truncate max-w-[150px] sm:max-w-[200px]"
                >
                  {product.brand}
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base md:text-lg font-bold text-[#1B2A22] leading-snug">
              <Link
                href={`/product/${product.ref}`}
                className="hover:text-[#1E5B45] hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E5B45] rounded"
              >
                {product.name || "Unnamed Product"}
              </Link>
            </h3>

            {/* Categories (max 2) */}
            {product.categories.length > 0 && (
              <div className="flex flex-wrap gap-1 sm:gap-1.5 pt-0.5">
                {product.categories.slice(0, 2).map((cat, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-normal bg-[#FBF8F2] text-[#5E6B63] border border-[#E4DEC3]"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Status Chips */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5 sm:pt-1 text-xs">
              {/* Ingredients chip */}
              <span
                data-testid="ingredients-chip"
                className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded border text-[10px] sm:text-[11px] font-medium ${
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
                className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded border text-[10px] sm:text-[11px] font-medium ${nutritionColor}`}
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
