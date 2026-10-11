import React from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MissingChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  label?: string;
  className?: string;
}

/**
 * MissingChip: A neutral badge indicating absent data.
 * Rule: Must be neutral (never red), indicating absence rather than an error or negative verdict.
 */
export function MissingChip({
  label = "Not listed",
  className,
  ...props
}: MissingChipProps) {
  return (
    <span
      data-testid="missing-chip"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-normal bg-stone-100 text-[#5E6B63] border border-stone-200",
        className
      )}
      {...props}
    >
      <HelpCircle className="h-3 w-3 shrink-0 text-stone-400" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
