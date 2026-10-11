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
import { ScanBarcode, Search, Sparkles, ShieldCheck, Database, Cpu, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Unified Premium Homepage Experience with Intense 3D Star Wars Style Spatial Perspective
 */
export function PerspectiveHeroScroll() {
  const [mounted, setMounted] = useState(false);
  const [capsuleExpanded, setCapsuleExpanded] = useState(false);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const scrollSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => {
      setCapsuleExpanded(true);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Track scroll through the spatial track
  const { scrollYProgress } = useScroll({
    target: scrollSectionRef,
    offset: ["start start", "end end"],
  });

  // DRAMATIC 3D PERSPECTIVE VALUES:
  // Starts receding deeply in distance with steep 45° angle, glides forward into view
  const yMotionValue = useTransform(scrollYProgress, [0, 1], [650, -180]);
  const rotateXValue = useTransform(scrollYProgress, [0, 1], [46, 28]);
  const translateZValue = useTransform(scrollYProgress, [0, 1], [-80, 40]);
  const transform = useMotionTemplate`rotateX(${rotateXValue}deg) translateY(${yMotionValue}px) translateZ(${translateZValue}px)`;

  const content = (
    <div className="w-full bg-[#FBF8F2] text-[#1B2A22] selection:bg-[#1E5B45] selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
          STAGE 1: CLEAN HERO SECTION (Unobstructed, elegant, functional)
         ───────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative min-h-[92vh] flex flex-col items-center justify-between px-4 pt-10 pb-16 sm:px-6 md:pt-14 md:pb-20 max-w-5xl mx-auto text-center"
      >
        <div className="absolute inset-0 bg-[radial-gradient(#1E5B45_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.05] pointer-events-none" />

        {/* Dynamic Expanding Brand Capsule (Skiper 3) */}
        <div className="flex flex-col items-center gap-6 max-w-3xl w-full z-10">
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

          {/* Headline & Tagline */}
          <div className="space-y-4 pt-2">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-[#1B2A22] leading-tight">
              Know what you eat. <br />
              <span className="bg-gradient-to-r from-[#1E5B45] via-[#2E8B63] to-[#C88214] bg-clip-text text-transparent">
                Understand what you buy.
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-[#5E6B63] max-w-xl mx-auto leading-relaxed">
              Ingrivo turns packaged food ingredient lists into transparent, plain-language facts with strict evidence and zero moralizing.
            </p>
          </div>

          {/* Interactive CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/scan"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#1E5B45] text-white text-sm font-bold shadow-lg shadow-[#1E5B45]/25 hover:bg-[#164634] transition-all hover:scale-[1.02] active:scale-95"
            >
              <ScanBarcode className="h-4 w-4" />
              <span>Scan Barcode</span>
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white border border-[#E4DEC3] text-[#1B2A22] text-sm font-bold shadow-xs hover:bg-[#FAF8F5] hover:border-[#1E5B45]/40 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Search className="h-4 w-4 text-[#1E5B45]" />
              <span>Search 3M+ Products</span>
            </Link>
          </div>

          {/* Trust Anchors */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-4 text-xs font-semibold text-[#5E6B63]">
            <span className="flex items-center gap-1.5">
              <Database className="h-4 w-4 text-[#1E5B45]" />
              Open Food Facts Data
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#1E5B45]" />
              100% On-Device Camera Privacy
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-[#C88214]" />
              Veracity-Locked AI
            </span>
          </div>
        </div>

        {/* Scroll Cue (Skiper 28 style) */}
        <div className="flex flex-col items-center gap-2 pt-12 pb-2 text-center text-[#1B2A22] z-10">
          <span className="relative text-[11px] font-bold tracking-widest uppercase opacity-40 after:absolute after:left-1/2 after:top-full after:h-10 after:w-px after:bg-gradient-to-b after:from-[#1B2A22]/40 after:to-transparent after:content-['']">
            scroll down to explore the manifesto
          </span>
          <ArrowDown className="h-4 w-4 text-[#1E5B45] animate-bounce mt-4 opacity-70" />
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          STAGE 2: INTENSE 3D PERSPECTIVE SCROLL RIG
          Deep 180px perspective camera with dramatic 46° spatial incline
         ───────────────────────────────────────────────────────────── */}
      <div
        ref={scrollSectionRef}
        className="relative z-0 h-[280vh] w-full bg-[#0D1612] text-white overflow-hidden border-t border-[#1E5B45]/30 shadow-2xl"
      >
        {/* Spatial 3D Perspective Plane */}
        <div
          className="sticky top-0 mx-auto flex h-screen items-center justify-center overflow-hidden pointer-events-none"
          style={{
            transformStyle: "preserve-3d",
            perspective: "180px",
            perspectiveOrigin: "50% 70%",
          }}
        >
          <motion.div
            style={{
              transformStyle: "preserve-3d",
              transform,
            }}
            className="w-full max-w-4xl text-center space-y-6 font-black tracking-tight select-none px-6"
          >
            {/* Carefully structured poetic lining */}
            <p className="text-3xl sm:text-5xl md:text-6xl text-emerald-400/90 tracking-wider uppercase drop-shadow-[0_4px_12px_rgba(52,211,153,0.3)]">
              No More Marketing Masks.
            </p>
            <p className="text-4xl sm:text-6xl md:text-7xl bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-300 bg-clip-text text-transparent uppercase drop-shadow-[0_6px_16px_rgba(251,191,36,0.25)]">
              Decode Every Single Ingredient.
            </p>
            <p className="text-3xl sm:text-5xl md:text-6xl text-emerald-300 tracking-wider uppercase">
              Zero Propaganda. Zero Guilt.
            </p>
            <p className="text-4xl sm:text-6xl md:text-7xl bg-gradient-to-r from-amber-300 via-yellow-200 to-emerald-400 bg-clip-text text-transparent uppercase">
              Pure Unfiltered Label Truth.
            </p>
            <p className="text-3xl sm:text-5xl md:text-6xl text-emerald-400/90 tracking-wider uppercase">
              Evidence Direct From The Box.
            </p>
            <p className="text-5xl sm:text-7xl md:text-8xl text-white font-black tracking-tighter uppercase drop-shadow-[0_8px_24px_rgba(255,255,255,0.4)]">
              INGRIVO.
            </p>

            {/* Cinematic depth fade */}
            <div className="pointer-events-none absolute bottom-[-100px] left-0 h-[45vh] w-full bg-gradient-to-t from-[#0D1612] via-[#0D1612]/80 to-transparent" />
          </motion.div>
        </div>
      </div>
    </div>
  );

  if (mounted) {
    return (
      <ReactLenis root options={{ lerp: 0.06, smoothWheel: true }}>
        {content}
      </ReactLenis>
    );
  }

  return content;
}
