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
import { ScanBarcode, Search, Sparkles, ArrowDown } from "lucide-react";

interface PerspectiveHeroScrollProps {
  headline?: string;
  subtext?: string;
}

export function PerspectiveHeroScroll({
  headline = "DECODE EVERY INGREDIENT. UNMASK FOOD LABELS. ZERO MARKETING SPIN. ZERO MORAL JUDGMENTS. STRICT VERACITY. EVIDENCE YOU CAN TRUST.",
}: PerspectiveHeroScrollProps) {
  const [mounted, setMounted] = useState(false);
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end end"],
  });

  // Perspective 3D rotation and vertical translation as user scrolls
  const yMotionValue = useTransform(scrollYProgress, [0, 1], [400, -80]);
  const rotateXValue = useTransform(scrollYProgress, [0, 1], [32, 10]);
  const opacityValue = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0.8, 1, 1, 0.5]);
  const transform = useMotionTemplate`rotateX(${rotateXValue}deg) translateY(${yMotionValue}px) translateZ(10px)`;

  const content = (
    <div
      ref={targetRef}
      className="relative z-0 h-[220vh] w-full overflow-hidden bg-gradient-to-b from-[#F5F2EB] via-[#ECE7DC] to-[#F5F2EB] text-[#1B2A22]"
    >
        {/* Subtle decorative grid/glow background */}
        <div className="absolute inset-0 bg-[radial-gradient(#1E5B45_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

        {/* Top Header Card / Call to Action */}
        <div className="sticky top-0 z-10 flex min-h-screen flex-col items-center justify-between px-4 py-12 sm:px-6 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center gap-4 text-center max-w-3xl pt-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1E5B45]/10 text-[#1E5B45] text-xs font-semibold tracking-wide uppercase border border-[#1E5B45]/20 backdrop-blur-xs">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Evidence-First Food Intelligence</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-[#1B2A22] leading-tight">
              Know what you eat. <br />
              <span className="text-[#1E5B45]">Understand what you buy.</span>
            </h1>

            <p className="text-base sm:text-lg text-[#5E6B63] max-w-xl mx-auto leading-relaxed">
              Ingrivo analyzes packaged food labels into plain English using transparent, verified evidence.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <Link
                href="/scan"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E5B45] text-white text-sm font-semibold shadow-md hover:bg-[#164433] transition-colors"
              >
                <ScanBarcode className="h-4 w-4" />
                <span>Scan Barcode</span>
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-[#E4DEC3] text-[#1B2A22] text-sm font-semibold shadow-xs hover:bg-[#FAF8F5] transition-colors"
              >
                <Search className="h-4 w-4" />
                <span>Search Products</span>
              </Link>
            </div>
          </div>

          {/* Scroll cue */}
          <div className="pointer-events-auto flex flex-col items-center gap-2 pb-6 text-center text-[#5E6B63]">
            <span className="text-xs uppercase tracking-widest font-semibold opacity-70">
              Scroll down to explore
            </span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            >
              <ArrowDown className="h-4 w-4 text-[#1E5B45]" />
            </motion.div>
          </div>
        </div>

        {/* Perspective 3D Scrolling Content Area */}
        <div
          className="sticky top-0 mx-auto flex h-screen items-center justify-center py-20 overflow-hidden"
          style={{
            transformStyle: "preserve-3d",
            perspective: "260px",
          }}
        >
          <motion.div
            style={{
              transformStyle: "preserve-3d",
              transform,
              opacity: opacityValue,
            }}
            className="w-full max-w-5xl px-6 text-center font-black tracking-tighter select-none leading-none"
          >
            <div className="text-5xl sm:text-7xl md:text-8xl bg-gradient-to-b from-[#1E5B45] via-[#2A755A] to-[#D97706] bg-clip-text text-transparent uppercase drop-shadow-xs">
              {headline}
            </div>

            {/* Gradient fog fade overlay at bottom */}
            <div className="pointer-events-none absolute bottom-[-100px] left-0 h-[65vh] w-full bg-gradient-to-t from-[#F5F2EB] via-[#F5F2EB]/80 to-transparent" />
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
