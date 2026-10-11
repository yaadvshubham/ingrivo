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
    <header className="sticky top-0 z-40 w-full border-b border-[#E4DEC3] bg-[#FBF8F2]/95 backdrop-blur-xs">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-[#1E5B45] hover:opacity-90 transition-opacity"
          aria-label="Ingrivo - Home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E5B45] text-white font-black text-lg">
            I
          </span>
          <span className="font-heading">Ingrivo</span>
        </Link>

        {/* Desktop Navigation */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-1.5"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#5E6B63] opacity-75 cursor-not-allowed select-none rounded-md"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{item.label}</span>
                    <span className="text-[10px] font-semibold bg-stone-200 text-stone-700 px-1.5 py-0.2 rounded uppercase">
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
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-[#1E5B45] text-white"
                    : "text-[#1B2A22] hover:bg-[#EFECE4] hover:text-[#1E5B45]"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mobile menu button */}
        <div className="flex md:hidden">
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-md p-2 text-[#1B2A22] hover:bg-[#EFECE4] focus:outline-none focus:ring-2 focus:ring-[#1E5B45]"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown panel */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          role="navigation"
          aria-label="Mobile Navigation"
          className="md:hidden border-b border-[#E4DEC3] bg-[#FBF8F2] px-4 pt-2 pb-4 space-y-1"
        >
          {NAV_ITEMS.map((item) => {
            const isEnabled = item.featureFlag ? isFeatureEnabled(item.featureFlag) : true;
            const isActive = pathname === item.href;
            const Icon = item.icon;

            if (!isEnabled) {
              return (
                <div
                  key={item.href}
                  className="flex items-center justify-between px-3 py-2 text-sm font-medium text-[#5E6B63] opacity-75 rounded-md"
                  aria-disabled="true"
                >
                  <div className="flex items-center gap-2">
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
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-[#1E5B45] text-white"
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
