"use client";

import { motion } from "framer-motion";
import React, { useState, useEffect } from "react";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Premium Hero Brand Loader
 * Faithfully adapts Skiper 3's dynamic expanding pill into the actual main hero brand centerpiece.
 * Starts as a compact glowing circular orb and springs outward to dynamically typewrite & reveal
 * the massive INGRIVO brand name and tagline.
 */
export function HeroBrandShowcase() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Spring expand after mount
    const timer = setTimeout(() => {
      setExpanded(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full py-4">
      {/* 1. Dynamic Expanding Capsule (Direct Skiper 3 mechanic) */}
      <motion.div layout className="relative flex items-center justify-center">
        <motion.div
          className={cn(
            "relative flex items-center justify-between overflow-hidden shadow-lg border border-[#1E5B45]/20 bg-white backdrop-blur-md transition-shadow hover:shadow-xl",
            expanded ? "rounded-3xl p-3 sm:p-5" : "rounded-full p-3.5"
          )}
          style={{ borderRadius: expanded ? 28 : 9999 }}
          initial={{ scale: 0, y: 30 }}
          animate={{
            scale: 1,
            y: 0,
            width: !expanded ? 64 : "min(94vw, 780px)",
          }}
          transition={{ type: "spring", bounce: 0.18, duration: 0.85 }}
        >
          {/* Left Brand Badge */}
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.4 }}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1E5B45] text-white shadow-md cursor-pointer"
              onClick={() => setExpanded((x) => !x)}
            >
              <Sparkles className="h-6 w-6 text-emerald-300" />
            </motion.div>

            {expanded && (
              <motion.div
                initial={{ opacity: 0, x: -16, filter: "blur(6px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-4xl font-black tracking-tight text-[#1B2A22]">
                    INGRIVO
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#1E5B45]/10 text-[#1E5B45] text-[11px] font-bold tracking-wide uppercase">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified Facts
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-[#1E5B45] tracking-tight">
                  Know what you eat. Understand what you buy.
                </p>
              </motion.div>
            )}
          </div>

          {/* Right Action / Toggle */}
          {expanded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2 shrink-0 pl-3"
            >
              <Link
                href="/about"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#1E5B45] hover:bg-[#1E5B45]/10 transition-colors"
              >
                <span>Mission</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
              <button
                type="button"
                onClick={() => setExpanded((x) => !x)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FBF8F2] hover:bg-[#EFECE4] text-[#1E5B45] text-sm font-bold transition-all active:scale-95 border border-[#E4DEC3]"
                aria-label="Toggle brand capsule"
                title="Toggle capsule"
              >
                {expanded ? "−" : "+"}
              </button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* 2. Hero Headline Statement */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="mt-8 space-y-3 max-w-3xl text-center"
      >
        <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#1B2A22] leading-tight">
          Food transparency, <br className="hidden sm:inline" />
          <span className="text-[#1E5B45]">unfiltered & uncompromised.</span>
        </h2>
        <p className="text-base sm:text-lg text-[#5E6B63] max-w-2xl mx-auto leading-relaxed">
          Ingrivo breaks down packaged food labels into plain English using transparent, verified evidence.
          Distinguish database facts, on-device OCR, and verified AI explanations with zero bias.
        </p>
      </motion.div>
    </div>
  );
}
