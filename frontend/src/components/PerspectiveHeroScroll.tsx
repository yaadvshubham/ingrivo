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
import { ScanBarcode, Search, Sparkles, ShieldCheck, Database, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Authentic Skiper 28 3D Perspective Text Scroll Implementation
 * On the exact original background (#FBF8F2) with zero artificial white overlay blocks.
 */
export function PerspectiveHeroScroll() {
  const [mounted, setMounted] = useState(false);
  const [capsuleExpanded, setCapsuleExpanded] = useState(false);
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => {
      setCapsuleExpanded(true);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Exact Skiper 28 Scroll Tracking
  const { scrollYProgress } = useScroll({
    target: targetRef,
  });

  // EXACT Skiper 28 motion values: [0, 1] -> [487, 0] with 30deg incline
  const yMotionValue = useTransform(scrollYProgress, [0, 1], [487, 0]);
  const transform = useMotionTemplate`rotateX(30deg) translateY(${yMotionValue}px) translateZ(10px)`;

  const content = (
    <div
      ref={targetRef}
      className="relative z-0 h-[300vh] w-full bg-[#FBF8F2] text-[#1B2A22]"
    >
      {/* ─────────────────────────────────────────────────────────────
          TOP VIEWPORT HERO (Skiper 28 top structure)
         ───────────────────────────────────────────────────────────── */}
      <div className="absolute left-1/2 top-[5%] grid -translate-x-1/2 content-start justify-items-center gap-6 text-center text-[#1B2A22] w-full max-w-4xl px-4 z-10">
        {/* Dynamic Expanding Brand Capsule (Skiper 3) */}
        <motion.div layout>
          <motion.div
            className={cn(
              "relative flex items-center justify-between overflow-hidden shadow-lg border border-[#E4DEC3] bg-white/95 backdrop-blur-md transition-all cursor-pointer hover:border-[#1E5B45]/40 hover:shadow-xl",
              capsuleExpanded
                ? "rounded-full px-5 py-2.5 w-[min(94vw,480px)]"
                : "rounded-full p-3 w-[64px]"
            )}
            initial={{ scale: 0, y: "100%" }}
            animate={{
              scale: 1,
              y: 0,
              width: !capsuleExpanded ? 64 : "min(94vw, 480px)",
            }}
            transition={{ type: "spring", bounce: 0.16, duration: 0.8 }}
            onClick={() => setCapsuleExpanded((x) => !x)}
          >
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

        {/* Main Brand Title & Tagline */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-[#1B2A22] leading-tight">
            Know what you eat. <br />
            <span className="text-[#1E5B45]">
              Understand what you buy.
            </span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-[#5E6B63] max-w-xl mx-auto leading-relaxed">
            Ingrivo turns packaged food ingredient lists into transparent, plain-language facts with strict evidence and zero moralizing.
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/scan"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-[#1E5B45] text-white text-sm font-bold shadow-lg shadow-[#1E5B45]/20 hover:bg-[#164634] transition-all hover:scale-[1.02] active:scale-95"
          >
            <ScanBarcode className="h-4 w-4" />
            <span>Scan Barcode</span>
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white border border-[#E4DEC3] text-[#1B2A22] text-sm font-bold shadow-xs hover:bg-[#FAF8F5] transition-all hover:scale-[1.02] active:scale-95"
          >
            <Search className="h-4 w-4 text-[#1E5B45]" />
            <span>Search 3M+ Products</span>
          </Link>
        </div>

        {/* Trust Badges */}
        <div className="hidden sm:flex items-center gap-6 text-xs font-semibold text-[#5E6B63]">
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
            <Cpu className="h-3.5 w-3.5 text-[#1E5B45]" />
            Veracity-Locked AI
          </span>
        </div>

        {/* Authentic Skiper 28 Scroll Indicator */}
        <span className="relative max-w-[14ch] text-xs uppercase tracking-widest font-bold opacity-40 pt-4 after:absolute after:left-1/2 after:top-full after:h-16 after:w-px after:bg-gradient-to-b after:from-[#1B2A22] after:to-transparent after:content-['']">
          scroll down to see
        </span>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          EXACT SKIPER 28 3D PERSPECTIVE SCROLL VIEWPORT
          Strict preserve-3d, perspective: 200px, font-geist/sans,
          seamless background gradient into #FBF8F2
         ───────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 mx-auto flex h-screen items-center justify-center bg-transparent py-20 pointer-events-none"
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
          className="w-full max-w-4xl text-center text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter text-[#1E5B45] leading-tight select-none px-4"
        >
          No more misleading health claims ..
          Decode every single preservative, additive, and emulsifier ..
          Zero propaganda, zero guilt, and zero moral judgments ..
          Direct verification from Open Food Facts database records ..
          On-device camera scanning with 100% local privacy ..
          Missing nutrients are never replaced with zero ..
          Ingrivo is the pure, unfiltered truth on packaged food ..
          Know what you eat, understand what you buy.
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
