"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Search,
  ScanBarcode,
  FileText,
  GitCompare,
  History,
  Info,
  Home,
  Lock,
} from "lucide-react";
import { isFeatureEnabled, FeatureFlags } from "@/lib/features";
import { cn } from "@/lib/utils";
import { UserNavButton } from "@/components/auth/UserNavButton";
import { Logo } from "@/components/brand/Logo";

interface NavItemConfig {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  featureFlag?: keyof FeatureFlags;
}

const NAV_ITEMS: NavItemConfig[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Search", href: "/search", icon: Search, featureFlag: "search" },
  { label: "Scan", href: "/scan", icon: ScanBarcode, featureFlag: "scan" },
  { label: "Label", href: "/label", icon: FileText, featureFlag: "label" },
  { label: "Compare", href: "/compare", icon: GitCompare, featureFlag: "compare" },
  { label: "History", href: "/history", icon: History, featureFlag: "history" },
  { label: "About", href: "/about", icon: Info },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E4DEC3]/80 bg-[#FBF8F2]/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Wordmark & Brand Logo */}
        <Link
          href="/"
          className="hover:opacity-90 transition-all group"
          aria-label="Pinfo - Home"
        >
          <Logo size="md" />
        </Link>

        {/* Desktop Navigation */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-1 bg-[#EFECE4]/50 p-1 rounded-xl border border-[#E4DEC3]/60"
        >
          {NAV_ITEMS.map((item) => {
            const isEnabled = item.featureFlag ? isFeatureEnabled(item.featureFlag) : true;
            const isActive = pathname === item.href;
            const Icon = item.icon;

            if (!isEnabled) {
              return (
                <div
                  key={item.href}
                  className="group relative inline-flex items-center"
                >
                  <span
                    aria-disabled="true"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#5E6B63] opacity-75 cursor-not-allowed select-none rounded-lg"
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{item.label}</span>
                    <span className="text-[9px] font-semibold bg-stone-200 text-stone-700 px-1 py-0.2 rounded uppercase">
                      Soon
                    </span>
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150",
                  isActive
                    ? "bg-[#1E5B45] text-white shadow-xs"
                    : "text-[#1B2A22] hover:bg-white/80 hover:text-[#1E5B45]"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Header Right Action: User Profile & Mobile Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <UserNavButton />

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-lg p-1.5 sm:p-2 text-[#1B2A22] hover:bg-[#EFECE4] focus:outline-none focus:ring-2 focus:ring-[#1E5B45] transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown panel */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          role="navigation"
          aria-label="Mobile Navigation"
          className="md:hidden border-b border-[#E4DEC3] bg-[#FBF8F2]/98 backdrop-blur-md px-4 pt-2 pb-5 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-200"
        >
          {NAV_ITEMS.map((item) => {
            const isEnabled = item.featureFlag ? isFeatureEnabled(item.featureFlag) : true;
            const isActive = pathname === item.href;
            const Icon = item.icon;

            if (!isEnabled) {
              return (
                <div
                  key={item.href}
                  className="flex items-center justify-between px-3 py-2 text-sm font-medium text-[#5E6B63] opacity-75 rounded-lg"
                  aria-disabled="true"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-stone-200 text-stone-700 px-2 py-0.5 rounded">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    Coming soon
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-[#1E5B45] text-white shadow-xs"
                    : "text-[#1B2A22] hover:bg-[#EFECE4]"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
