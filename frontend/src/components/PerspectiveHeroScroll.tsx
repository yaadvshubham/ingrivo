"use client";

import {
  motion,
  useMotionTemplate,
  useScroll,
  useTransform,
  type MotionValue,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const MANIFESTO_LINES = [
  "No more misleading health halos or marketing gimmicks ..",
  "Decode every single preservative, additive, and emulsifier ..",
  "Zero guilt, zero propaganda, and zero moral judgments ..",
  "Direct verification from Open Food Facts database records ..",
  "100% on-device camera scanning with absolute local privacy ..",
  "Missing nutrients are explicitly flagged — never assumed zero ..",
  "Evidence-first transparency for every conscious decision ..",
  "Know what you eat .. Understand what you buy ..",
  "Ingrivo is the unfiltered truth on packaged food.",
];

/**
 * Individual Manifesto Line Component
 * Moves line-by-line through 3D perspective space (perspective: 220px, rotateX: 30deg).
 * Each line glides independently with custom staggered focal depth, parallax scale, and soft overlap.
 */
function ManifestoLine({
  text,
  index,
  total,
  scrollYProgress,
}: {
  text: string;
  index: number;
  total: number;
  scrollYProgress: MotionValue<number>;
}) {
  // Focal center for each line across the scroll runway
  const step = 0.82 / (total - 1);
  const center = 0.08 + index * step;

  // Generous window radius ensures at least 2 lines are always active and visible in 3D space
  const windowRadius = step * 1.35;
  const start = Math.max(0, center - windowRadius);
  const end = Math.min(1, center + windowRadius);

  // Y-translation through the 3D perspective field:
  // Starts below at +280px, reaches focal center at 0px, ascends away at -280px
  const y = useTransform(scrollYProgress, [start, center, end], [280, 0, -280]);

  // Dynamic 3D tilt: tilted backwards on entry, flattens in focal plane, tilts as it recedes
  const rotateX = useTransform(scrollYProgress, [start, center, end], [30, 15, 26]);
  const scale = useTransform(scrollYProgress, [start, center, end], [0.94, 1.04, 0.94]);
  const z = useTransform(scrollYProgress, [start, center, end], [-12, 16, -12]);

  // Smooth opacity: peak focus at center, soft overlap on borders
  const startOpacity = index === 0 ? 0.95 : 0;
  const opacity = useTransform(
    scrollYProgress,
    [start, center - step * 0.5, center, center + step * 0.5, end],
    [startOpacity, 0.55, 1, 0.55, 0]
  );

  const transform = useMotionTemplate`rotateX(${rotateX}deg) translateY(${y}px) translateZ(${z}px) scale(${scale})`;

  return (
    <motion.div
      style={{
        transformStyle: "preserve-3d",
        transform,
        opacity,
      }}
      className="absolute w-full max-w-4xl px-4 sm:px-6 text-center select-none pointer-events-none"
    >
      <p className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#1E5B45] leading-tight drop-shadow-xs">
        {text}
      </p>
    </motion.div>
  );
}

/**
 * Unified Premium Homepage Hero & 3D Perspective Experience
 * Combines:
 * 1. Skiper 3: Spring expanding brand pill & tagline reveal
 * 2. Skiper 28: Authentic 3D preserve-3d perspective line-by-line transitions in warm luxury palette
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

  // Pinned across full sticky container duration
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end end"],
  });

  // Smooth hero fadeout as user starts scrolling into the manifesto lines (0 -> 0.10)
  const heroOpacity = useTransform(scrollYProgress, [0, 0.10], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.10], [0, -30]);
  const heroPointerEvents = useTransform(heroOpacity, (v) => (v > 0.05 ? "auto" : "none"));

  const content = (
    <div
      ref={targetRef}
      className="relative z-0 h-[350vh] w-full bg-[#FBF8F2] text-[#1B2A22] overflow-x-hidden selection:bg-[#1E5B45] selection:text-white"
    >
      {/* ─────────────────────────────────────────────────────────────
          TOP STICKY HEADER & CALL TO ACTION (Smooth fade on scroll)
         ───────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex min-h-screen flex-col items-center justify-between px-4 py-8 sm:px-6 pointer-events-none">
        {/* Dynamic Expanding Brand Capsule (Skiper 3) & Hero Content */}
        <motion.div
          style={{ opacity: heroOpacity, y: heroY, pointerEvents: heroPointerEvents }}
          className="flex flex-col items-center gap-4 text-center max-w-4xl pt-4"
        >
          <motion.div layout>
            <motion.div
              className={cn(
                "relative flex items-center justify-between overflow-hidden shadow-xl border border-[#E4DEC3] bg-white/95 backdrop-blur-md transition-all cursor-pointer",
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
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E5B45] text-white shadow-md">
                  <Sparkles className="h-5 w-5" />
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

              {/* Toggle button */}
              {capsuleExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="flex items-center gap-1.5 pl-2"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5E6B63] mr-1">
                    Verified
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1E5B45]/10 text-[#1E5B45] text-xs font-bold">
                    ✓
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>

          {/* Tagline & Subtext */}
          <div className="space-y-3 pt-2">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-[#1B2A22] leading-tight">
              Know what you eat. <br />
              <span className="text-[#1E5B45]">Understand what you buy.</span>
            </h1>
            <p className="text-sm sm:text-base text-[#5E6B63] max-w-xl mx-auto leading-relaxed">
              Ingrivo turns packaged food ingredient lists into plain-language facts with zero moralizing.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/scan"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1E5B45] text-white text-sm font-bold shadow-lg shadow-[#1E5B45]/25 hover:bg-[#164634] transition-transform active:scale-95"
            >
              <ScanBarcode className="h-4 w-4" />
              <span>Scan Barcode</span>
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-[#E4DEC3] text-[#1B2A22] text-sm font-bold shadow-xs hover:bg-[#FAF8F5] transition-transform active:scale-95"
            >
              <Search className="h-4 w-4 text-[#1E5B45]" />
              <span>Search Products</span>
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
              <Cpu className="h-3.5 w-3.5 text-[#1E5B45]" />
              Veracity-Locked AI
            </span>
          </div>
        </motion.div>

        {/* Scroll Cue (Skiper 28 style) */}
        <motion.div
          style={{ opacity: heroOpacity }}
          className="flex flex-col items-center gap-3 pb-8 text-center text-[#1B2A22]"
        >
          <span className="relative text-[11px] font-bold tracking-widest uppercase opacity-40 after:absolute after:left-1/2 after:top-full after:h-12 after:w-px after:bg-gradient-to-b after:from-[#1E5B45]/40 after:to-transparent after:content-['']">
            scroll down to see
          </span>
        </motion.div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SKIPER 28 3D PERSPECTIVE LINE-BY-LINE TEXT SCROLL
          Exact perspective: 220px, rotateX: 30deg physics.
          Each line transitions independently through the focal plane.
         ───────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 mx-auto flex h-screen items-center justify-center bg-transparent py-20 overflow-hidden pointer-events-none"
        style={{
          transformStyle: "preserve-3d",
          perspective: "220px",
        }}
      >
        {/* Soft atmospheric top and bottom gradient fades */}
        <div className="pointer-events-none absolute top-0 left-0 z-10 h-32 w-full bg-gradient-to-b from-[#FBF8F2] to-transparent" />
        <div className="pointer-events-none absolute bottom-0 left-0 z-10 h-40 w-full bg-gradient-to-t from-[#FBF8F2] to-transparent" />

        {/* 3D Perspective Canvas with Independent Lines */}
        <div
          className="relative flex h-full w-full items-center justify-center"
          style={{
            transformStyle: "preserve-3d",
          }}
        >
          {MANIFESTO_LINES.map((line, idx) => (
            <ManifestoLine
              key={idx}
              text={line}
              index={idx}
              total={MANIFESTO_LINES.length}
              scrollYProgress={scrollYProgress}
            />
          ))}
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

