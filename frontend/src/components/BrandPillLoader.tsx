"use client";

import { motion } from "framer-motion";
import React, { useState, useEffect } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Animated Dynamic Pill Loader / Showcase Component
 * Inspired by Skiper 3 Dynamic Pill Animation.
 * Loads with an initial spring expansion, reveals the brand badge,
 * and allows clicking to expand into the full tagline banner.
 */
export function BrandPillLoader() {
  const [expanded, setExpanded] = useState(false);

  // Auto-expand smoothly on load after brief delay to delight the user
  useEffect(() => {
    const timer = setTimeout(() => {
      setExpanded(true);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <motion.div layout>
        <motion.div
          className={cn(
            "relative flex items-center justify-between overflow-hidden rounded-full border border-[#1E5B45]/20 shadow-sm transition-all duration-300",
            expanded
              ? "bg-white text-[#1B2A22] px-4 py-2"
              : "bg-[#1E5B45] text-white p-2.5 hover:bg-[#164433]"
          )}
          initial={{ scale: 0, y: "60%" }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.18, duration: 0.8 }}
        >
          {/* Brand Icon & Name */}
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1E5B45] text-white shadow-2xs">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-extrabold text-sm tracking-wider uppercase text-[#1E5B45]">
              INGRIVO
            </span>
          </div>

          {/* Expanded Tagline Section */}
          {expanded && (
            <motion.div
              initial={{ opacity: 0, filter: "blur(4px)", x: -10 }}
              animate={{ opacity: 1, filter: "blur(0px)", x: 0 }}
              exit={{ opacity: 0, filter: "blur(4px)" }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="flex items-center gap-3 pl-3 text-xs sm:text-sm font-medium text-[#5E6B63]"
            >
              <span className="hidden sm:inline-block h-3.5 w-px bg-[#E4DEC3]" />
              <span className="text-[#1B2A22] font-semibold">
                Know what you eat.
              </span>
              <span className="text-[#1E5B45] font-semibold">
                Understand what you buy.
              </span>
              <Link
                href="/about"
                className="inline-flex items-center gap-1 text-xs text-[#1E5B45] hover:underline font-semibold ml-1"
              >
                Learn more
                <ArrowRight className="h-3 w-3" />
              </Link>
            </motion.div>
          )}

          {/* Toggle pill button */}
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? "Collapse brand banner" : "Expand brand banner"}
            className="ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#FBF8F2] hover:bg-[#EFECE4] text-[#1E5B45] text-xs font-bold transition-transform active:scale-90"
          >
            {expanded ? "−" : "+"}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
