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
 * Unified Premium Homepage Hero & 3D Perspective Experience
 * Combines:
 * 1. Skiper 3: Spring expanding brand pill & tagline reveal
 * 2. Skiper 28: Authentic 3D preserve-3d perspective text scroll in warm luxury aesthetic
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
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Skiper 28 Scroll Tracking
  const { scrollYProgress } = useScroll({
    target: targetRef,
  });

  // Authentic Skiper 28 Motion Values
  const yMotionValue = useTransform(scrollYProgress, [0, 1], [487, 0]);
  const transform = useMotionTemplate`rotateX(30deg) translateY(${yMotionValue}px) translateZ(10px)`;

  const content = (
    <div
      ref={targetRef}
      className="relative z-0 h-[280vh] w-full bg-[#f5f4f3] text-black overflow-x-hidden selection:bg-[#ff5800] selection:text-white"
    >
      {/* ─────────────────────────────────────────────────────────────
          TOP STICKY HEADER & CALL TO ACTION (Clean, interactive)
         ───────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex min-h-screen flex-col items-center justify-between px-4 py-8 sm:px-6 pointer-events-none">
        {/* Dynamic Expanding Brand Capsule (Skiper 3) */}
        <div className="pointer-events-auto flex flex-col items-center gap-4 text-center max-w-4xl pt-4">
          <motion.div layout>
            <motion.div
              className={cn(
                "relative flex items-center justify-between overflow-hidden shadow-xl border border-black/10 bg-white/90 backdrop-blur-md transition-all cursor-pointer",
                capsuleExpanded
                  ? "rounded-full px-5 py-2.5 w-[min(92vw,460px)]"
                  : "rounded-full p-3 w-[64px]"
              )}
              initial={{ scale: 0, y: "100%" }}
              animate={{
                scale: 1,
                y: 0,
                width: !capsuleExpanded ? 64 : "min(92vw, 460px)",
              }}
              transition={{ type: "spring", bounce: 0.16, duration: 0.8 }}
              onClick={() => setCapsuleExpanded((x) => !x)}
            >
              {/* Brand Logo & Name */}
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff5800] text-white shadow-md">
                  <Sparkles className="h-5 w-5" />
                </span>
                {capsuleExpanded && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-left"
                  >
                    <span className="block font-black text-base tracking-wider uppercase text-black">
                      INGRIVO
                    </span>
                    <span className="block text-[11px] font-semibold text-[#ff5800] tracking-tight">
                      Know what you eat. Understand what you buy.
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Toggle button */}
              {capsuleExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="flex items-center gap-1.5 pl-2"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-black/40 mr-1">
                    Verified
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 text-black text-xs font-bold">
                    ✓
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>

          {/* Tagline & Subtext */}
          <div className="space-y-3 pt-2">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-black leading-tight">
              Know what you eat. <br />
              <span className="text-[#ff5800]">Understand what you buy.</span>
            </h1>
            <p className="text-sm sm:text-base text-black/60 max-w-xl mx-auto leading-relaxed">
              Ingrivo turns packaged food ingredient lists into plain-language facts with zero moralizing.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/scan"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#ff5800] text-white text-sm font-bold shadow-lg shadow-[#ff5800]/25 hover:bg-[#e04e00] transition-transform active:scale-95"
            >
              <ScanBarcode className="h-4 w-4" />
              <span>Scan Barcode</span>
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-black/10 text-black text-sm font-bold shadow-sm hover:bg-black/5 transition-transform active:scale-95"
            >
              <Search className="h-4 w-4" />
              <span>Search Products</span>
            </Link>
          </div>

          {/* Trust points */}
          <div className="hidden sm:flex items-center gap-6 pt-4 text-xs font-semibold text-black/50">
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-[#ff5800]" />
              Open Food Facts Data
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#ff5800]" />
              100% On-Device Camera
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-[#ff5800]" />
              Veracity-Locked AI
            </span>
          </div>
        </div>

        {/* Scroll Cue (Skiper 28 style) */}
        <div className="pointer-events-auto flex flex-col items-center gap-3 pb-8 text-center text-black">
          <span className="relative text-[11px] font-bold tracking-widest uppercase opacity-40 after:absolute after:left-1/2 after:top-full after:h-12 after:w-px after:bg-gradient-to-b after:from-black/40 after:to-transparent after:content-['']">
            scroll down to see
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SKIPER 28 3D PERSPECTIVE TEXT SCROLL
          Exact perspective: 200px and rotateX: 30deg transform
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
          className="w-full max-w-4xl text-center text-5xl sm:text-7xl font-bold tracking-tighter text-[#ff5800] leading-tight select-none px-4"
        >
          DECODE EVERY INGREDIENT .. UNMASK FOOD LABELS .. ZERO MARKETING GIMMICKS ..
          ZERO MORAL JUDGMENTS .. REAL EVIDENCE DIRECT FROM FOOD LABELS ..
          TRANSPARENT .. UNBIASED .. EVIDENCE YOU CAN TRUST ..
          KNOW WHAT YOU EAT .. UNDERSTAND WHAT YOU BUY ..
          INGRIVO IS THE TRUTH ON PACKAGED FOOD.
          <div className="absolute bottom-0 left-0 h-[60vh] w-full bg-gradient-to-b from-transparent to-[#f5f4f3]" />
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
