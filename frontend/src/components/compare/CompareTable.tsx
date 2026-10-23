"use client";

import React from "react";
import {
  CompareResponse,
  CompareNutrientRow,
} from "@/lib/schemas/compare";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MissingChip } from "@/components/MissingChip";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompareTableProps {
  data: CompareResponse;
}

export function CompareTable({ data }: CompareTableProps) {
  const { a, b, nutrient_rows, ingredients_diff, allergens_diff } = data;

  const renderNutrientCell = (
    val: number | null | undefined,
    unit: string,
    provenance: string,
    derivation?: string | null
  ) => {
    if (val === null || val === undefined) {
      return <MissingChip label="Not available" />;
    }

    return (
      <div className="space-y-1">
        <div className="font-semibold text-[#1B2A22]">
          {val} {unit}
        </div>
        {provenance === "derived" && (
          <div className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 border border-amber-200" title={derivation || "Calculated conversion"}>
            <span>Calculated</span>
          </div>
        )}
        {derivation && (
          <p className="text-[10px] text-[#5E6B63] leading-tight">{derivation}</p>
        )}
      </div>
    );
  };

  const renderDifferenceSummary = (row: CompareNutrientRow) => {
    if (!row.comparable) {
      return (
        <div className="text-xs text-stone-500 italic">
          <span>Incomparable: </span>
          <span>{row.incomparable_reason || "Basis or value not comparable"}</span>
        </div>
      );
    }

    if (row.direction === "same") {
      return (
        <span className="text-xs font-medium text-[#5E6B63]">
          Equal amount (0.0 {row.unit})
        </span>
      );
    }

    const directionLabel =
      row.direction === "a_higher"
        ? `${a.name || "Product A"} is higher by ${row.diff_absolute} ${row.unit} (+${row.diff_relative_percent}%)`
        : `${b.name || "Product B"} is higher by ${row.diff_absolute} ${row.unit} (+${row.diff_relative_percent}%)`;

    return (
      <div className="space-y-1">
        <span className="text-xs font-medium text-[#1B2A22] block">
          {directionLabel}
        </span>
        {row.notable && (
          <div
            className="inline-flex items-center gap-1 rounded-sm bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-900 border border-purple-200"
            title={row.notable_reason || "Notable difference"}
          >
            <AlertCircle className="h-3 w-3 text-purple-700" aria-hidden="true" />
            <span>Notable difference</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {/* 1. Completeness Overview Card */}
      <Card className="border border-[#E4DEC3] bg-white shadow-2xs">
        <CardHeader className="pb-3 border-b border-[#E4DEC3]/60">
          <CardTitle className="text-base font-bold text-[#1B2A22]">
            Data Completeness Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 p-3.5 rounded-lg border border-[#E4DEC3] bg-[#FBF8F2]/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5E6B63]">
                {a.name || "Product A"}
              </span>
              <span className="text-xs font-semibold text-[#1E5B45]">
                {Math.round(a.completeness.score * 100)}% Complete
              </span>
            </div>
            {a.completeness.missing.length > 0 ? (
              <p className="text-xs text-[#5E6B63]">
                Missing fields: {a.completeness.missing.join(", ")}
              </p>
            ) : (
              <p className="text-xs text-[#1E5B45]">All key fields present.</p>
            )}
          </div>

          <div className="space-y-2 p-3.5 rounded-lg border border-[#E4DEC3] bg-[#FBF8F2]/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5E6B63]">
                {b.name || "Product B"}
              </span>
              <span className="text-xs font-semibold text-[#1E5B45]">
                {Math.round(b.completeness.score * 100)}% Complete
              </span>
            </div>
            {b.completeness.missing.length > 0 ? (
              <p className="text-xs text-[#5E6B63]">
                Missing fields: {b.completeness.missing.join(", ")}
              </p>
            ) : (
              <p className="text-xs text-[#1E5B45]">All key fields present.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Desktop Side-by-Side Comparison Table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-[#E4DEC3] bg-white shadow-xs">
        <table className="w-full text-left border-collapse text-sm">
          <caption className="sr-only">
            Side-by-side nutrient and ingredient comparison between Product A and Product B
          </caption>
          <thead>
            <tr className="border-b border-[#E4DEC3] bg-[#FBF8F2]">
              <th scope="col" className="p-4 font-bold text-[#1B2A22] w-1/4">
                Nutrient
              </th>
              <th scope="col" className="p-4 font-bold text-[#1B2A22] w-1/4">
                <span className="block truncate">{a.name || "Product A"}</span>
                <span className="text-xs font-normal text-[#5E6B63]">
                  Basis: {a.basis}
                </span>
              </th>
              <th scope="col" className="p-4 font-bold text-[#1B2A22] w-1/4">
                <span className="block truncate">{b.name || "Product B"}</span>
                <span className="text-xs font-normal text-[#5E6B63]">
                  Basis: {b.basis}
                </span>
              </th>
              <th scope="col" className="p-4 font-bold text-[#1B2A22] w-1/4">
                Factual Difference
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4DEC3]/60">
            {nutrient_rows.map((row) => (
              <tr
                key={row.nutrient}
                className={cn(
                  "transition-colors",
                  !row.comparable
                    ? "bg-stone-50/70 text-stone-500"
                    : row.notable
                    ? "bg-purple-50/30"
                    : "hover:bg-[#FBF8F2]/50"
                )}
              >
                <td className="p-4 font-medium text-[#1B2A22]">
                  {row.label}
                  <span className="text-xs text-[#5E6B63] block">({row.unit})</span>
                </td>
                <td className="p-4">
                  {renderNutrientCell(row.val_a, row.unit, row.provenance_a, row.derivation_a)}
                </td>
                <td className="p-4">
                  {renderNutrientCell(row.val_b, row.unit, row.provenance_b, row.derivation_b)}
                </td>
                <td className="p-4">
                  {renderDifferenceSummary(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Mobile Stacked Layout (No Horizontal Scroll) */}
      <div className="md:hidden space-y-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-[#1B2A22] uppercase tracking-wider">
            Nutritional Breakdown
          </span>
          <span className="text-[11px] text-[#5E6B63]">
            {a.basis} vs {b.basis}
          </span>
        </div>

        <div className="space-y-3">
          {nutrient_rows.map((row) => (
            <div
              key={row.nutrient}
              className={cn(
                "rounded-xl border border-[#E4DEC3] bg-white p-4 space-y-3 shadow-2xs",
                !row.comparable && "bg-stone-50/80 text-stone-600",
                row.notable && "border-purple-200 bg-purple-50/20"
              )}
            >
              <div className="flex items-center justify-between border-b border-[#E4DEC3]/60 pb-2">
                <span className="font-bold text-sm text-[#1B2A22]">
                  {row.label}
                </span>
                <span className="text-xs text-[#5E6B63]">({row.unit})</span>
              </div>

              {/* Two columns of values */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg border border-[#E4DEC3]/60 bg-[#FBF8F2]/50 space-y-1">
                  <span className="text-[11px] font-semibold text-[#5E6B63] block truncate">
                    {a.name || "Product A"}
                  </span>
                  {renderNutrientCell(row.val_a, row.unit, row.provenance_a, row.derivation_a)}
                </div>

                <div className="p-2.5 rounded-lg border border-[#E4DEC3]/60 bg-[#FBF8F2]/50 space-y-1">
                  <span className="text-[11px] font-semibold text-[#5E6B63] block truncate">
                    {b.name || "Product B"}
                  </span>
                  {renderNutrientCell(row.val_b, row.unit, row.provenance_b, row.derivation_b)}
                </div>
              </div>

              {/* Difference callout */}
              <div className="pt-1">
                {renderDifferenceSummary(row)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Approximate Ingredients Diff */}
      <Card className="border border-[#E4DEC3] bg-white shadow-2xs">
        <CardHeader className="pb-3 border-b border-[#E4DEC3]/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg font-bold text-[#1B2A22]">
              Ingredient Comparison
            </CardTitle>
            <span className="rounded bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
              Approximate Match
            </span>
          </div>
          <p className="text-xs text-[#5E6B63] pt-1">
            {ingredients_diff.disclaimer}
          </p>
        </CardHeader>
        <CardContent className="pt-4 space-y-6">
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1E5B45]">
              Shared Ingredients ({ingredients_diff.shared.length})
            </h4>
            {ingredients_diff.shared.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {ingredients_diff.shared.map((ing, idx) => (
                  <span
                    key={idx}
                    className="rounded bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs text-emerald-900"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#5E6B63] italic">No shared ingredients identified.</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-[#E4DEC3]/60">
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5E6B63]">
                Unique to {a.name || "Product A"} ({ingredients_diff.only_a.length})
              </h4>
              {ingredients_diff.only_a.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {ingredients_diff.only_a.map((ing, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-[#FBF8F2] border border-[#E4DEC3] px-2 py-1 text-xs text-[#1B2A22]"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#5E6B63] italic">None identified.</p>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5E6B63]">
                Unique to {b.name || "Product B"} ({ingredients_diff.only_b.length})
              </h4>
              {ingredients_diff.only_b.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {ingredients_diff.only_b.map((ing, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-[#FBF8F2] border border-[#E4DEC3] px-2 py-1 text-xs text-[#1B2A22]"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#5E6B63] italic">None identified.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Allergen Diff */}
      <Card className="border border-[#E4DEC3] bg-white shadow-2xs">
        <CardHeader className="pb-3 border-b border-[#E4DEC3]/60">
          <CardTitle className="text-lg font-bold text-[#1B2A22]">
            Declared Allergen Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-3.5 rounded-lg border border-[#E4DEC3] bg-[#FBF8F2]/60 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5E6B63]">
                {a.name || "Product A"} Declared Allergens
              </span>
              {allergens_diff.shared.length > 0 || allergens_diff.only_a.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[...allergens_diff.shared, ...allergens_diff.only_a].map((all, i) => (
                    <span
                      key={i}
                      className="rounded bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs text-amber-900 font-medium"
                    >
                      {all}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#5E6B63] italic">{allergens_diff.note_a}</p>
              )}
              <p className="text-[11px] text-[#5E6B63]">{allergens_diff.note_a}</p>
            </div>

            <div className="p-3.5 rounded-lg border border-[#E4DEC3] bg-[#FBF8F2]/60 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5E6B63]">
                {b.name || "Product B"} Declared Allergens
              </span>
              {allergens_diff.shared.length > 0 || allergens_diff.only_b.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[...allergens_diff.shared, ...allergens_diff.only_b].map((all, i) => (
                    <span
                      key={i}
                      className="rounded bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs text-amber-900 font-medium"
                    >
                      {all}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#5E6B63] italic">{allergens_diff.note_b}</p>
              )}
              <p className="text-[11px] text-[#5E6B63]">{allergens_diff.note_b}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
