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
import { ScanBarcode, Search, ArrowDown, ShieldCheck, Database, Cpu, Sparkles } from "lucide-react";
import { BrandPillLoader } from "@/components/BrandPillLoader";

export function PerspectiveHeroScroll() {
  const [mounted, setMounted] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { scrollYProgress } = useScroll({
    target: scrollContainerRef,
    offset: ["start end", "end end"],
  });

  // Balanced cinematic 3D perspective scrolling
  // Starts deeper down (420px) and smoothly rises up into view with perspective tilt
  const yMotionValue = useTransform(scrollYProgress, [0, 1], [420, 0]);
  const rotateXValue = useTransform(scrollYProgress, [0, 1], [26, 6]);
  const opacityValue = useTransform(scrollYProgress, [0, 0.25, 0.85, 1], [0.3, 1, 1, 0.7]);
  const transform = useMotionTemplate`rotateX(${rotateXValue}deg) translateY(${yMotionValue}px) translateZ(10px)`;

  const content = (
    <div className="w-full bg-[#FBF8F2] text-[#1B2A22]">
      {/* ─────────────────────────────────────────────────────────────
          STAGE 1: BRAND SHOWCASE & TAGLINE
          Visible on first viewport without any obscuring overlays
         ───────────────────────────────────────────────────────────── */}
      <section className="relative px-4 pt-12 pb-20 sm:px-6 md:pt-16 md:pb-24 max-w-5xl mx-auto text-center space-y-8">
        {/* Dynamic Interactive Brand Pill Loader */}
        <BrandPillLoader />

        {/* Brand Name & Tagline */}
        <div className="space-y-4">
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight text-[#1B2A22] leading-none">
            INGRIVO
          </h1>
          <p className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-[#1E5B45]">
            Know what you eat. Understand what you buy.
          </p>
        </div>

        {/* Concise Description */}
        <p className="text-base sm:text-lg text-[#5E6B63] max-w-2xl mx-auto leading-relaxed">
          Ingrivo turns cryptic packaged food ingredient labels into transparent, evidence-based facts.
          Distinguish database entries, on-device OCR, and verified AI explanations with zero moral judgments.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/scan"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#1E5B45] text-white text-sm font-semibold shadow-md hover:bg-[#164433] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <ScanBarcode className="h-4 w-4" />
            <span>Scan Barcode</span>
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white border border-[#E4DEC3] text-[#1B2A22] text-sm font-semibold shadow-xs hover:bg-[#FAF8F5] transition-all hover:border-[#1E5B45]/40"
          >
            <Search className="h-4 w-4" />
            <span>Search 3M+ Products</span>
          </Link>
        </div>

        {/* Value Props Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 max-w-3xl mx-auto text-left">
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-white border border-[#E4DEC3]/80 shadow-2xs">
            <Database className="h-4 w-4 text-[#1E5B45] shrink-0" />
            <span className="text-xs font-semibold text-[#1B2A22]">Open Food Facts Database</span>
          </div>
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-white border border-[#E4DEC3]/80 shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-[#1E5B45] shrink-0" />
            <span className="text-xs font-semibold text-[#1B2A22]">100% On-Device Camera Privacy</span>
          </div>
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-white border border-[#E4DEC3]/80 shadow-2xs">
            <Cpu className="h-4 w-4 text-[#1E5B45] shrink-0" />
            <span className="text-xs font-semibold text-[#1B2A22]">Veracity-Guaranteed AI Notes</span>
          </div>
        </div>

        {/* Scroll Cue pointing down */}
        <div className="pt-8 flex flex-col items-center gap-2 text-[#5E6B63]">
          <span className="text-xs font-semibold uppercase tracking-widest opacity-60">
            Scroll down to explore the transparency manifesto
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          >
            <ArrowDown className="h-4 w-4 text-[#1E5B45]" />
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          STAGE 2: 3D PERSPECTIVE TEXT SCROLL SECTION
          Starts clean, scrolls up into view, seamlessly transitions
         ───────────────────────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        className="relative z-0 h-[220vh] w-full bg-[#111915] text-white rounded-t-3xl shadow-2xl overflow-hidden mt-8"
      >
        {/* Subtle grid texture */}
        <div className="absolute inset-0 bg-[radial-gradient(#34D399_1px,transparent_1px)] [background-size:28px_28px] opacity-10 pointer-events-none" />

        {/* Top Header Label for Manifesto */}
        <div className="pt-12 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#34D399]/10 text-[#34D399] text-xs font-semibold tracking-widest uppercase border border-[#34D399]/20">
            <Sparkles className="h-3 w-3" />
            Transparency Manifesto
          </span>
        </div>

        {/* Perspective Viewport */}
        <div
          className="sticky top-0 mx-auto flex h-[85vh] items-center justify-center px-6 overflow-hidden"
          style={{
            transformStyle: "preserve-3d",
            perspective: "400px",
          }}
        >
          <motion.div
            style={{
              transformStyle: "preserve-3d",
              transform,
              opacity: opacityValue,
            }}
            className="w-full max-w-4xl text-center font-black tracking-tight select-none leading-tight px-4"
          >
            <div className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl bg-gradient-to-b from-[#34D399] via-[#A7F3D0] to-[#E3A02B] bg-clip-text text-transparent uppercase drop-shadow-md py-4">
              DECODE EVERY INGREDIENT. UNMASK FOOD LABELS. ZERO MARKETING SPIN. ZERO MORAL JUDGMENTS. STRICT EVIDENCE YOU CAN TRUST.
            </div>

            {/* Gradient fog fade overlay at bottom */}
            <div className="pointer-events-none absolute bottom-0 left-0 h-[30vh] w-full bg-gradient-to-t from-[#111915] via-[#111915]/80 to-transparent" />
          </motion.div>
        </div>
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
