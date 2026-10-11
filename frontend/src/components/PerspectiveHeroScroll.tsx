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
import {
  ScanBarcode,
  Search,
  Sparkles,
  ShieldCheck,
  Database,
  Cpu,
  ArrowDown,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Editorial Luxury 3D Perspective Experience
 *
 * Senior Design Architecture:
 * - SECTION 1: Editorial Luxury Hero with Skiper 3 Spring Brand Capsule.
 *   Contains pristine brand identity, headline, CTAs, and trust metrics.
 *   Lives in its own breathing space so it NEVER overlaps or collides with 3D text.
 *
 * - SECTION 2: Authentic Skiper 28 3D Perspective Scroll Canvas.
 *   As user scrolls down, this sticky 3D runway engages.
 *   Text glides upward in pure 3D perspective (rotateX: 24deg, perspective: 260px)
 *   with atmospheric fog on the native #FBF8F2 cream canvas (no black, no white cards).
 */
export function PerspectiveHeroScroll() {
  const [mounted, setMounted] = useState(false);
  const [capsuleExpanded, setCapsuleExpanded] = useState(true);

  // Dedicated scroll tracking container for the 3D Perspective runway
  const perspectiveContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { scrollYProgress } = useScroll({
    target: perspectiveContainerRef,
    offset: ["start start", "end end"],
  });

  // Skiper 28 3D Perspective interpolation:
  // Glides gracefully from lower depth up through the perspective vanishing plane
  const yMotionValue = useTransform(scrollYProgress, [0, 1], [480, -360]);
  const transform = useMotionTemplate`rotateX(24deg) translateY(${yMotionValue}px) translateZ(10px)`;

  const content = (
    <div className="relative w-full bg-[#FBF8F2] text-[#1B2A22]">
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: EDITORIAL LUXURY HERO (Pristine, Zero Collision)
         ───────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[88vh] flex-col items-center justify-between px-4 pt-6 pb-12 sm:px-6">
        <div className="flex flex-col items-center gap-6 text-center max-w-4xl pt-2">
          {/* Skiper 3 Dynamic Brand Pill Capsule */}
          <motion.div layout>
            <motion.div
              className={cn(
                "relative flex items-center justify-between overflow-hidden shadow-md border border-[#E4DEC3] bg-white/95 backdrop-blur-md cursor-pointer transition-shadow hover:shadow-lg hover:border-[#1E5B45]/40",
                capsuleExpanded
                  ? "rounded-full px-5 py-2.5 w-[min(94vw,500px)]"
                  : "rounded-full p-2.5 w-[58px]"
              )}
              initial={{ scale: 0, y: "60%" }}
              animate={{
                scale: 1,
                y: 0,
                width: !capsuleExpanded ? 58 : "min(94vw, 500px)",
              }}
              transition={{ type: "spring", bounce: 0.16, duration: 0.7 }}
              onClick={() => setCapsuleExpanded((prev) => !prev)}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1E5B45] to-[#164634] text-white shadow-sm shadow-[#1E5B45]/30">
                  <Sparkles className="h-4.5 w-4.5 text-emerald-300" />
                </span>

                {capsuleExpanded && (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    className="text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-sm tracking-widest uppercase text-[#1B2A22]">
                        INGRIVO
                      </span>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C88214]" />
                      <span className="text-[10px] font-bold text-[#5E6B63] uppercase tracking-wider">
                        Veracity Engine
                      </span>
                    </div>
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
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-1.5 pl-2"
                >
                  <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-[#5E6B63]">
                    Verified
                  </span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1E5B45]/10 text-[#1E5B45]">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>

          {/* Headline & Mission Subtitle */}
          <div className="space-y-4 pt-2">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-[#1B2A22] leading-[1.08]">
              Know what you eat. <br />
              <span className="bg-gradient-to-r from-[#1E5B45] via-[#2E8B63] to-[#C88214] bg-clip-text text-transparent">
                Understand what you buy.
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-[#5E6B63] max-w-2xl mx-auto leading-relaxed font-normal">
              Ingrivo turns packaged food ingredient lists into transparent, plain-language facts with strict evidence, verified provenance, and zero moralizing.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <Link
              href="/scan"
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-[#1E5B45] text-white text-sm font-bold shadow-lg shadow-[#1E5B45]/25 hover:bg-[#164634] transition-all hover:scale-[1.02] active:scale-95"
            >
              <ScanBarcode className="h-4.5 w-4.5" />
              <span>Scan Barcode</span>
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-white border border-[#E4DEC3] text-[#1B2A22] text-sm font-bold shadow-xs hover:bg-[#FAF8F5] hover:border-[#1E5B45]/40 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Search className="h-4.5 w-4.5 text-[#1E5B45]" />
              <span>Search 3M+ Products</span>
            </Link>
          </div>

          {/* Trust Anchors */}
          <div className="flex flex-wrap items-center justify-center gap-5 pt-3 text-xs font-semibold text-[#5E6B63]">
            <span className="flex items-center gap-1.5">
              <Database className="h-4 w-4 text-[#1E5B45]" />
              Open Food Facts Data
            </span>
            <span className="hidden sm:inline text-[#E4DEC3]">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#1E5B45]" />
              100% On-Device Camera
            </span>
            <span className="hidden sm:inline text-[#E4DEC3]">•</span>
            <span className="flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-[#C88214]" />
              Veracity-Locked AI
            </span>
          </div>
        </div>

        {/* Scroll Invitation Cue */}
        <div className="flex flex-col items-center gap-2 pt-10 pb-2 text-center text-[#1B2A22]">
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#5E6B63]/80">
            Scroll to experience manifesto
          </span>
          <div className="relative flex flex-col items-center">
            <div className="h-10 w-px bg-gradient-to-b from-[#1E5B45] via-[#C88214] to-transparent" />
            <ArrowDown className="h-3.5 w-3.5 text-[#1E5B45] animate-bounce -mt-1 opacity-70" />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: AUTHENTIC SKIPER 28 3D PERSPECTIVE SCROLL CANVAS
          Dedicated 280vh runway. No hero interference.
          3D Perspective (perspective: 260px, rotateX: 24deg).
          Glides seamlessly on native #FBF8F2 cream background.
         ───────────────────────────────────────────────────────────── */}
      <div
        ref={perspectiveContainerRef}
        className="relative z-0 h-[280vh] w-full bg-[#FBF8F2]"
      >
        <div
          className="sticky top-0 mx-auto flex h-screen w-full items-center justify-center overflow-hidden bg-transparent"
          style={{
            transformStyle: "preserve-3d",
            perspective: "260px",
          }}
        >
          {/* Subtle Runway Header */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#E4DEC3] bg-[#FBF8F2]/90 backdrop-blur-xs px-4 py-1 text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#1E5B45] shadow-xs">
              The Ingrivo Manifesto
            </span>
            <div className="h-6 w-px bg-gradient-to-b from-[#1E5B45]/60 to-transparent" />
          </div>

          {/* Top Atmospheric Fog on native canvas */}
          <div className="pointer-events-none absolute top-0 left-0 z-10 h-36 w-full bg-gradient-to-b from-[#FBF8F2] via-[#FBF8F2]/80 to-transparent" />

          {/* 3D Tilted Text Plane */}
          <motion.div
            style={{
              transformStyle: "preserve-3d",
              transform,
            }}
            className="w-full max-w-4xl px-6 text-center select-none space-y-6 sm:space-y-8"
          >
            <p className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#1E5B45] leading-tight">
              No more misleading health claims.
            </p>

            <p className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#2E8B63] leading-tight">
              Decode every single preservative, additive, and emulsifier in plain language.
            </p>

            <p className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#164634] leading-tight">
              Zero propaganda. Zero guilt. Zero moral judgments.
            </p>

            <p className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#C88214] leading-tight">
              Direct verification from Open Food Facts database records.
            </p>

            <p className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#1E5B45] leading-tight">
              100% on-device camera scanning with absolute local privacy.
            </p>

            <p className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#2E8B63] leading-tight">
              Missing nutrients are explicitly marked — never replaced with zero.
            </p>

            <p className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#C88214] leading-tight">
              Pure, unfiltered evidence for every conscious decision.
            </p>

            <p className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#1E5B45] leading-tight">
              Know what you eat. Understand what you buy.
            </p>
          </motion.div>

          {/* Bottom Atmospheric Fog on native canvas */}
          <div className="pointer-events-none absolute bottom-0 left-0 z-10 h-44 w-full bg-gradient-to-t from-[#FBF8F2] via-[#FBF8F2]/90 to-transparent" />
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
