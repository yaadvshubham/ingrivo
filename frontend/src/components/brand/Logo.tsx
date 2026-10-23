import React from "react";

interface LogoIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/**
 * Pinfo Official Brand Icon
 * Concept: Stylized 'I' lettermark converging a botanical sprout (food/nature)
 * with a lens/aperture arc (scientific intelligence) and a golden vitality spark.
 */
export function LogoIcon({ size = 36, className = "", ...props }: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Pinfo Logo"
      {...props}
    >
      <defs>
        {/* Background rounded squircle gradient */}
        <linearGradient id="ingrivoBgGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E5B45" />
          <stop offset="100%" stopColor="#0F3325" />
        </linearGradient>

        {/* Vibrant leaf glow gradient */}
        <linearGradient id="ingrivoLeafGrad" x1="28" y1="20" x2="72" y2="78" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="60%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        {/* Nutrition spark gold */}
        <linearGradient id="ingrivoGoldGrad" x1="60" y1="16" x2="84" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Inner shadow filter for premium tactile feel */}
        <filter id="ingrivoShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0F3325" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Squircle Container */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="26"
        fill="url(#ingrivoBgGrad)"
        stroke="#2E8B63"
        strokeWidth="1.5"
        strokeOpacity="0.35"
      />

      {/* Subtle organic contour lines (representing food layers & data scanning) */}
      <path
        d="M20 78 C 36 68, 64 68, 80 78"
        stroke="#34D399"
        strokeWidth="1.5"
        strokeOpacity="0.18"
        strokeLinecap="round"
      />
      <path
        d="M24 84 C 38 76, 62 76, 76 84"
        stroke="#34D399"
        strokeWidth="1.2"
        strokeOpacity="0.12"
        strokeLinecap="round"
      />

      {/* Left Leaf / Botanical Wing of the 'I' */}
      <path
        d="M32 68 C 30 50, 42 36, 52 28 C 50 44, 42 62, 32 68 Z"
        fill="url(#ingrivoLeafGrad)"
        filter="url(#ingrivoShadow)"
      />

      {/* Right Leaf Arch (Completing the organic food sprout) */}
      <path
        d="M52 28 C 66 34, 72 50, 68 68 C 58 64, 52 46, 52 28 Z"
        fill="#2E8B63"
        opacity="0.9"
      />

      {/* Central 'I' Stem Pillar (Structure & Transparency) */}
      <rect
        x="45"
        y="38"
        width="10"
        height="36"
        rx="5"
        fill="#FFFFFF"
        filter="url(#ingrivoShadow)"
      />

      {/* Organic Center Vein */}
      <path
        d="M50 32 L50 68"
        stroke="#E6F4EA"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* The Vitality Spark / Gold Sun Star (Nutrition Intelligence) */}
      <path
        d="M50 15 C 50 18, 52 20, 55 20 C 52 20, 50 22, 50 25 C 50 22, 48 20, 45 20 C 48 20, 50 18, 50 15 Z"
        fill="url(#ingrivoGoldGrad)"
      />
      <circle cx="50" cy="20" r="2.2" fill="#FEF3C7" />

      {/* Intelligence Scanning Ray (Focus dot top right) */}
      <circle cx="71" cy="25" r="3" fill="#34D399" opacity="0.8" />
    </svg>
  );
}

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  light?: boolean;
  className?: string;
  iconOnly?: boolean;
}

export function Logo({
  size = "md",
  showTagline = true,
  light = false,
  className = "",
  iconOnly = false,
}: LogoProps) {
  const iconSizes = {
    sm: 28,
    md: 36,
    lg: 44,
    xl: 56,
  };

  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-3xl",
  };

  const taglineSizes = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
    xl: "text-sm",
  };

  const currentIconSize = iconSizes[size];

  if (iconOnly) {
    return <LogoIcon size={currentIconSize} className={`shrink-0 ${className}`} />;
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <LogoIcon
        size={currentIconSize}
        className="shrink-0 transition-transform duration-200 group-hover:scale-105"
      />
      <div className="flex flex-col">
        <span
          className={`font-black tracking-tight leading-none ${textSizes[size]} ${
            light ? "text-white" : "text-[#1B2A22]"
          }`}
          style={{ fontFamily: "var(--font-sans), sans-serif" }}
        >
          Pinfo
        </span>
        {showTagline && (
          <span
            className={`font-semibold uppercase tracking-widest mt-0.5 leading-none ${taglineSizes[size]} ${
              light ? "text-emerald-200/90" : "text-[#1E5B45]"
            }`}
          >
            Food Intelligence
          </span>
        )}
      </div>
    </div>
  );
}
