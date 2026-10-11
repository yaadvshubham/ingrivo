import React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SampleBannerProps {
  children?: React.ReactNode;
  className?: string;
  customNotice?: string;
}

/**
 * SampleBanner: Wraps fictional or demonstrative data with a clearly visible disclaimer label.
 * Rule: Fictional sample products and preview comparisons must be explicitly marked.
 */
export function SampleBanner({
  children,
  className,
  customNotice,
}: SampleBannerProps) {
  return (
    <div
      data-testid="sample-banner-wrapper"
      className={cn(
        "relative rounded-xl border border-amber-300 bg-amber-50/40 p-4 md:p-5 my-4",
        className
      )}
    >
      <div
        data-testid="sample-banner-tag"
        className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-amber-900 bg-amber-100/90 border border-amber-300 w-fit px-2.5 py-1 rounded-md"
      >
        <AlertCircle className="h-4 w-4 text-amber-800" aria-hidden="true" />
        <span>
          {customNotice || "Sample, illustrative data, not a real product"}
        </span>
      </div>
      <div className="sample-content">{children}</div>
    </div>
  );
}
