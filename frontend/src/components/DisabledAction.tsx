import React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisabledActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  explanation?: string;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
  className?: string;
}

/**
 * DisabledAction: A button-like control for unavailable features.
 * Attributes:
 * - aria-disabled="true"
 * - Visible "Coming soon" text badge
 * - Accessible explanation
 */
export function DisabledAction({
  label,
  explanation = "This feature is currently in development.",
  icon,
  variant = "secondary",
  className,
  ...props
}: DisabledActionProps) {
  const variantStyles = {
    primary:
      "bg-stone-200 text-stone-500 border border-stone-300 cursor-not-allowed opacity-80",
    secondary:
      "bg-[#EFECE4] text-[#5E6B63] border border-[#E4DEC3] cursor-not-allowed opacity-80",
    outline:
      "bg-transparent text-[#5E6B63] border border-dashed border-[#E4DEC3] cursor-not-allowed opacity-80",
  }[variant];

  return (
    <div className="inline-flex flex-col gap-1 w-full sm:w-auto">
      <button
        type="button"
        aria-disabled="true"
        disabled
        data-testid="disabled-action-btn"
        className={cn(
          "inline-flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-none select-none",
          variantStyles,
          className
        )}
        {...props}
      >
        <span className="flex items-center gap-2">
          {icon}
          <span>{label}</span>
        </span>
        <span
          data-testid="coming-soon-badge"
          className="inline-flex items-center gap-1 rounded bg-stone-300/60 px-1.5 py-0.5 text-[11px] font-semibold text-stone-700 uppercase tracking-wider"
        >
          <Lock className="h-3 w-3" aria-hidden="true" />
          Coming soon
        </span>
      </button>
      {explanation && (
        <span
          data-testid="disabled-action-explanation"
          className="text-xs text-[#5E6B63] px-1"
        >
          {explanation}
        </span>
      )}
    </div>
  );
}
