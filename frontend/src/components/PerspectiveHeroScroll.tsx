"use client";

import {
  motion,
  useMotionTemplate,
  useScroll,
  useTransform,
} from "framer-motion";
import ReactLenis from "lenis/react";
import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ScanBarcode, Search, Sparkles, ArrowRight, ShieldCheck, Database, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Unified Premium Homepage Hero & 3D Perspective Scroll Experience
 *
 * Design Palette:
 * - Surface / Canvas: Warm Natural Silk (#FBF8F2)
 * - Deep Luxury Forest: #164634 / #1E5B45
 * - Rich Royal Emerald: #2E8B63 / #34D399
 * - Warm Gold / Saffron Accent: #C88214 / #E3A02B
 * - Deep Velvet Ink: #14221A / #1B2A22
 * - Muted Botanical Slate: #5E6B63
 * - Border: Warm Linen (#E4DEC3)
 */
export function PerspectiveHeroScroll() {
  const [mounted, setMounted] = useState(false);
  const [capsuleExpanded, setCapsuleExpanded] = useState(false);
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    // Smooth auto-expand after initial entrance
    const timer = setTimeout(() => {
      setCapsuleExpanded(true);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  // Skiper 28 Scroll Tracking
  const { scrollYProgress } = useScroll({
    target: targetRef,
  });

  // Authentic Skiper 28 3D Perspective Motion Values
  const yMotionValue = useTransform(scrollYProgress, [0, 1], [487, 0]);
  const transform = useMotionTemplate`rotateX(30deg) translateY(${yMotionValue}px) translateZ(10px)`;

  const content = (
    <div
      ref={targetRef}
      className="relative z-0 h-[280vh] w-full bg-[#FBF8F2] text-[#1B2A22] overflow-x-hidden selection:bg-[#1E5B45] selection:text-white"
    >
      {/* Subtle luxury botanical grain / grid background */}
      <div className="absolute inset-0 bg-[radial-gradient(#1E5B45_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.06] pointer-events-none" />

      {/* ─────────────────────────────────────────────────────────────
          TOP STICKY HERO & CALL TO ACTION (Clean, interactive, rich)
         ───────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex min-h-screen flex-col items-center justify-between px-4 py-8 sm:px-6 pointer-events-none">
        {/* Dynamic Expanding Brand Capsule (Skiper 3 Motion) */}
        <div className="pointer-events-auto flex flex-col items-center gap-5 text-center max-w-4xl pt-4">
          <motion.div layout>
            <motion.div
              className={cn(
                "relative flex items-center justify-between overflow-hidden shadow-lg border border-[#E4DEC3] bg-white/95 backdrop-blur-md transition-all cursor-pointer hover:border-[#1E5B45]/40 hover:shadow-xl",
                capsuleExpanded
                  ? "rounded-full px-5 py-2.5 w-[min(94vw,500px)]"
                  : "rounded-full p-3 w-[64px]"
              )}
              initial={{ scale: 0, y: "100%" }}
              animate={{
                scale: 1,
                y: 0,
                width: !capsuleExpanded ? 64 : "min(94vw, 500px)",
              }}
              transition={{ type: "spring", bounce: 0.16, duration: 0.85 }}
              onClick={() => setCapsuleExpanded((x) => !x)}
            >
              {/* Brand Logo & Name */}
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1E5B45] to-[#164634] text-white shadow-md shadow-[#1E5B45]/20">
                  <Sparkles className="h-5 w-5 text-emerald-300" />
                </span>
                {capsuleExpanded && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-left"
                  >
                    <span className="block font-black text-base tracking-wider uppercase text-[#1B2A22]">
                      INGRIVO
                    </span>
                    <span className="block text-[11px] font-semibold text-[#1E5B45] tracking-tight">
                      Know what you eat. Understand what you buy.
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Verified Badge / Expansion indicator */}
              {capsuleExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="flex items-center gap-1.5 pl-2"
                >
                  <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider text-[#5E6B63] mr-1">
                    Verified
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1E5B45]/10 text-[#1E5B45] text-xs font-bold">
                    ✓
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>

          {/* Headline & Subtext */}
          <div className="space-y-3 pt-2">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-[#1B2A22] leading-tight">
              Know what you eat. <br />
              <span className="bg-gradient-to-r from-[#1E5B45] via-[#2E8B63] to-[#C88214] bg-clip-text text-transparent">
                Understand what you buy.
              </span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-[#5E6B63] max-w-xl mx-auto leading-relaxed">
              Ingrivo turns packaged food ingredient lists into plain-language facts with strict evidence and zero moralizing.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/scan"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#1E5B45] text-white text-sm font-bold shadow-lg shadow-[#1E5B45]/25 hover:bg-[#164634] transition-all hover:scale-[1.02] active:scale-95"
            >
              <ScanBarcode className="h-4 w-4" />
              <span>Scan Barcode</span>
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-white border border-[#E4DEC3] text-[#1B2A22] text-sm font-bold shadow-xs hover:bg-[#FAF8F5] hover:border-[#1E5B45]/40 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Search className="h-4 w-4 text-[#1E5B45]" />
              <span>Search 3M+ Products</span>
            </Link>
          </div>

          {/* Trust points */}
          <div className="hidden sm:flex items-center gap-6 pt-4 text-xs font-semibold text-[#5E6B63]">
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-[#1E5B45]" />
              Open Food Facts Data
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#1E5B45]" />
              100% On-Device Camera
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-[#C88214]" />
              Veracity-Locked AI
            </span>
          </div>
        </div>

        {/* Scroll Cue (Skiper 28 style in warm ink) */}
        <div className="pointer-events-auto flex flex-col items-center gap-3 pb-8 text-center text-[#1B2A22]">
          <span className="relative text-[11px] font-bold tracking-widest uppercase opacity-40 after:absolute after:left-1/2 after:top-full after:h-12 after:w-px after:bg-gradient-to-b after:from-[#1B2A22]/40 after:to-transparent after:content-['']">
            scroll down to see
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SKIPER 28 3D PERSPECTIVE TEXT SCROLL
          Exact perspective: 200px and rotateX: 30deg transform
          Styled in rich metallic emerald & saffron gradient
         ───────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 mx-auto flex h-screen items-center justify-center bg-transparent py-20 overflow-hidden pointer-events-none"
        style={{
          transformStyle: "preserve-3d",
          perspective: "200px",
        }}
      >
        <motion.div
          style={{
            transformStyle: "preserve-3d",
            transform,
          }}
          className="w-full max-w-4xl text-center text-5xl sm:text-7xl font-bold tracking-tighter leading-tight select-none px-4 bg-gradient-to-b from-[#1E5B45] via-[#2E8B63] to-[#C88214] bg-clip-text text-transparent drop-shadow-sm"
        >
          DECODE EVERY INGREDIENT .. UNMASK FOOD LABELS .. ZERO MARKETING GIMMICKS ..
          ZERO MORAL JUDGMENTS .. REAL EVIDENCE DIRECT FROM FOOD LABELS ..
          TRANSPARENT .. UNBIASED .. EVIDENCE YOU CAN TRUST ..
          KNOW WHAT YOU EAT .. UNDERSTAND WHAT YOU BUY ..
          INGRIVO IS THE TRUTH ON PACKAGED FOOD.
          <div className="absolute bottom-0 left-0 h-[60vh] w-full bg-gradient-to-b from-transparent to-[#FBF8F2]" />
        </motion.div>
      </div>
    </div>
  );

  if (mounted) {
    return (
      <ReactLenis root options={{ lerp: 0.08, smoothWheel: true }}>
        {content}
      </ReactLenis>
    );
  }

  return content;
}
