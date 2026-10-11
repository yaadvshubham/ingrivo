import React from "react";
import { Database, Camera, Sparkles, Calculator, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProvenanceVariant = "source" | "label" | "ocr" | "ai" | "derived" | "user_corrected" | "missing";

interface ProvenanceBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: ProvenanceVariant;
  customLabel?: string;
  className?: string;
}

const BADGE_CONFIG: Record<
  ProvenanceVariant,
  {
    label: string;
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
    bgClass: string;
    textClass: string;
    borderClass: string;
  }
> = {
  source: {
    label: "Source data",
    icon: Database,
    bgClass: "bg-emerald-50",
    textClass: "text-[#1E5B45]",
    borderClass: "border-[#1E5B45]/25",
  },
  label: {
    label: "From your label",
    icon: Camera,
    bgClass: "bg-sky-50",
    textClass: "text-sky-800",
    borderClass: "border-sky-300",
  },
  ocr: {
    label: "From your label",
    icon: Camera,
    bgClass: "bg-sky-50",
    textClass: "text-sky-800",
    borderClass: "border-sky-300",
  },
  ai: {
    label: "AI explanation",
    icon: Sparkles,
    bgClass: "bg-purple-50",
    textClass: "text-purple-800",
    borderClass: "border-purple-300",
  },
  derived: {
    label: "Calculated",
    icon: Calculator,
    bgClass: "bg-amber-50",
    textClass: "text-amber-800",
    borderClass: "border-amber-300",
  },
  user_corrected: {
    label: "User verified",
    icon: Camera,
    bgClass: "bg-emerald-50",
    textClass: "text-emerald-800",
    borderClass: "border-emerald-300",
  },
  missing: {
    label: "Not available",
    icon: HelpCircle,
    bgClass: "bg-stone-100",
    textClass: "text-[#5E6B63]",
    borderClass: "border-stone-300",
  },
};

/**
 * ProvenanceBadge indicates where a piece of information originates.
 * Rule: Provenance colors must never be the only signal.
 * Each badge renders an icon AND a visible text label.
 */
export function ProvenanceBadge({ variant, customLabel, className, ...props }: ProvenanceBadgeProps) {
  const config = BADGE_CONFIG[variant] || BADGE_CONFIG.missing;
  const IconComponent = config.icon;

  return (
    <span
      data-testid={`provenance-badge-${variant}`}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border shadow-xs transition-colors",
        config.bgClass,
        config.textClass,
        config.borderClass,
        className
      )}
      {...props}
    >
      <IconComponent className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{customLabel || config.label}</span>
    </span>
  );
}
