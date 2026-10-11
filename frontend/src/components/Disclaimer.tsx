import React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisclaimerProps {
  className?: string;
  variant?: "inline" | "banner";
}

/**
 * Disclaimer: Mandatory legal and informational disclosure.
 * "Ingrivo is for general information only. It is not medical advice."
 */
export function Disclaimer({ className, variant = "inline" }: DisclaimerProps) {
  if (variant === "banner") {
    return (
      <div
        data-testid="disclaimer-banner"
        role="note"
        aria-label="Medical and health disclaimer"
        className={cn(
          "flex items-start gap-3 rounded-lg border border-[#E4DEC3] bg-[#EFECE4]/60 p-3.5 text-xs text-[#5E6B63]",
          className
        )}
      >
        <Info className="h-4 w-4 shrink-0 text-[#1E5B45] mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-medium text-[#1B2A22]">Important Notice</p>
          <p>Ingrivo is for general information only. It is not medical advice.</p>
        </div>
      </div>
    );
  }

  return (
    <p
      data-testid="disclaimer-text"
      className={cn("text-xs text-[#5E6B63] leading-relaxed", className)}
    >
      Ingrivo is for general information only. It is not medical advice.
    </p>
  );
}
