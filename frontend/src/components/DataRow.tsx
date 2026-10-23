import React from "react";
import { ProvenanceBadge, ProvenanceVariant } from "@/components/ProvenanceBadge";
import { MissingChip } from "@/components/MissingChip";
import { cn } from "@/lib/utils";

interface DataRowProps {
  label: string;
  value: React.ReactNode | string | number | null | undefined;
  unit?: string;
  provenance?: ProvenanceVariant;
  className?: string;
}

/**
 * DataRow displays a labeled piece of data with an optional ProvenanceBadge.
 * Rules:
 * - If value is null or undefined, displays MissingChip.
 * - Never converts null/undefined to "0".
 * - If value is 0 (a real number), displays "0".
 */
export function DataRow({
  label,
  value,
  unit,
  provenance,
  className,
}: DataRowProps) {
  const isMissing = value === null || value === undefined;

  return (
    <div
      data-testid="data-row"
      className={cn(
        "flex flex-row items-center justify-between py-2 sm:py-2.5 px-2.5 sm:px-3 border-b border-[#E4DEC3]/60 last:border-b-0 gap-2 sm:gap-4",
        className
      )}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 pr-2">
        <span className="text-xs sm:text-sm font-medium text-[#1B2A22] truncate">{label}</span>
        {provenance && <ProvenanceBadge variant={provenance} />}
      </div>
      <div className="text-xs sm:text-sm font-semibold sm:font-normal text-[#1B2A22] text-right shrink-0">
        {isMissing ? (
          <MissingChip />
        ) : (
          <span>
            {value}
            {unit ? ` ${unit}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
