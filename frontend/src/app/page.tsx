"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  ScanBarcode,
  Search,
  Camera,
  Database,
  Sparkles,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  FileText,
  GitCompare,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { MissingChip } from "@/components/MissingChip";
import { DataRow } from "@/components/DataRow";
import { SampleBanner } from "@/components/SampleBanner";
import { Disclaimer } from "@/components/Disclaimer";
import { TypewriterTagline } from "@/components/TypewriterTagline";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

const TRENDING_SEARCHES = [
  { label: "Nutella", icon: "🍫", query: "Nutella" },
  { label: "Coca-Cola", icon: "🥤", query: "Coca-Cola" },
  { label: "Oat Milk", icon: "🥛", query: "Oat Milk" },
  { label: "Oreo", icon: "🍪", query: "Oreo" },
  { label: "Guacamole", icon: "🥑", query: "Guacamole" },
];

export default function HomePage() {
  const router = useRouter();
  const { user, preferences, loginWithGoogle } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/search?q=${encodeURIComponent(q)}`)}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <div className="space-y-16 sm:space-y-24 pb-20 overflow-hidden">
      {/* 1. HERO SECTION WITH AMBIENT BACKGROUND & SEARCH */}
      <section className="relative pt-8 sm:pt-14 pb-6 px-4 sm:px-6 max-w-5xl mx-auto text-center space-y-8">
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-96 bg-gradient-to-tr from-emerald-500/10 via-amber-200/20 to-teal-500/10 blur-3xl -z-10 pointer-events-none rounded-full" />

        {/* User state badge / greeting */}
        {user ? (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-900 text-xs font-semibold tracking-wide border border-emerald-200 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Welcome back, <strong>{user.name || "Explorer"}</strong></span>
            {preferences?.dietary_preferences && preferences.dietary_preferences.length > 0 && (
              <span className="text-emerald-700 font-normal">
                • {preferences.dietary_preferences.slice(0, 2).join(", ")}
              </span>
            )}
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1E5B45]/10 text-[#1E5B45] text-xs font-semibold tracking-wide uppercase border border-[#1E5B45]/20 shadow-xs">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Evidence-Based Food Intelligence</span>
          </div>
        )}

        <TypewriterTagline className="mb-4" />

        <p className="text-sm sm:text-base md:text-lg text-[#5E6B63] max-w-2xl mx-auto leading-relaxed px-2">
          Pinfo translates complex packaged food labels into plain English using transparent,
          verifiable evidence. Open Food Facts database facts, on-device label OCR, and educational
          AI explanations—with zero moral judgments.
        </p>

        {/* Authentication Notice if logged out */}
        {!user && (
          <div className="max-w-xl mx-auto p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-amber-50/50 to-emerald-50 border border-[#E4DEC3] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1E5B45] text-white flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <strong className="block text-xs font-bold text-[#1B2A22]">Login Required for Full Features</strong>
                <span className="text-[11px] text-[#5E6B63]">Sign in to search 3M+ foods, scan barcodes & chat with AI</span>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={() => loginWithGoogle().catch((e) => console.warn("Google sign in cancelled:", e))}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 text-[#1B2A22] text-xs font-bold border border-[#D5CEB8] shadow-xs flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google</span>
              </button>
              <Link
                href="/login"
                className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl bg-[#1E5B45] hover:bg-[#164634] text-white text-xs font-bold shadow-xs transition-colors text-center"
              >
                Sign In / Sign Up
              </Link>
            </div>
          </div>
        )}

        {/* HERO LIVE SEARCH BAR */}
        <ScrollReveal blur={10} yOffset={18} delay={150} className="max-w-2xl mx-auto pt-2">
          <form
            onSubmit={handleSearchSubmit}
            className="relative flex items-center shadow-md hover:shadow-lg rounded-2xl transition-all duration-200 border-2 border-[#E4DEC3] bg-white p-1.5 focus-within:border-[#1E5B45] focus-within:ring-2 focus-within:ring-[#1E5B45]/20"
          >
            <div className="pl-3.5 text-[#5E6B63]">
              <Search className="h-5 w-5" aria-hidden="true" />
            </div>
            <input
              type="text"
              name="q"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by food name (e.g. Nutella) or enter barcode..."
              className="w-full bg-transparent px-3 py-2 text-sm sm:text-base text-[#1B2A22] placeholder:text-[#8F9E95] focus:outline-none"
              autoComplete="off"
            />
            <button
              type="submit"
              className="shrink-0 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-[#1E5B45] hover:bg-[#164634] text-white font-medium text-xs sm:text-sm shadow-xs transition-colors"
            >
              Search
            </button>
          </form>

          {/* Quick trending chips */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-3 text-xs text-[#5E6B63]">
            <span className="font-semibold text-[#1B2A22]">Try searching:</span>
            {TRENDING_SEARCHES.map((item) => (
              <Link
                key={item.label}
                href={user ? `/search?q=${encodeURIComponent(item.query)}` : `/login?redirect=${encodeURIComponent(`/search?q=${encodeURIComponent(item.query)}`)}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 hover:bg-[#1E5B45]/10 hover:text-[#1E5B45] border border-[#E4DEC3] transition-all hover:scale-105 active:scale-95"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </ScrollReveal>

        {/* HERO QUICK ACTION CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 pt-4 sm:pt-6 max-w-5xl mx-auto text-left">
          {/* Card 1: Instant Camera Scan */}
          <ScrollReveal delay={0} blur={8} yOffset={16} className="h-full">
            <Link
              href={user ? "/scan" : "/login?redirect=/scan"}
              className="h-full group glass-card glass-card-hover smooth-lift rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-[#E4DEC3] flex flex-col justify-between cursor-pointer"
            >
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-[#1E5B45]/10 text-[#1E5B45] flex items-center justify-center group-hover:bg-[#1E5B45] group-hover:text-white transition-colors">
                    <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-emerald-200">
                    Instant Snap
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-base text-[#1B2A22] group-hover:text-[#1E5B45] transition-colors flex items-center gap-1">
                    Camera Scanner
                    <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#5E6B63] mt-0.5 sm:mt-1 line-clamp-2">
                    Scan packaged food barcodes or QR codes with sub-50ms detection speed.
                  </p>
                </div>
              </div>
            </Link>
          </ScrollReveal>

          {/* Card 2: Catalog Search */}
          <ScrollReveal delay={80} blur={8} yOffset={16} className="h-full">
            <Link
              href={user ? "/search" : "/login?redirect=/search"}
              className="h-full group glass-card glass-card-hover smooth-lift rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-[#E4DEC3] flex flex-col justify-between cursor-pointer"
            >
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <Search className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-amber-200">
                    3M+ Foods
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-base text-[#1B2A22] group-hover:text-amber-800 transition-colors flex items-center gap-1">
                    Catalog Search
                    <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#5E6B63] mt-0.5 sm:mt-1 line-clamp-2">
                    Look up nutrition facts and ingredient records from Open Food Facts.
                  </p>
                </div>
              </div>
            </Link>
          </ScrollReveal>

          {/* Card 3: Label Photo OCR */}
          <ScrollReveal delay={160} blur={8} yOffset={16} className="h-full">
            <Link
              href={user ? "/label" : "/login?redirect=/label"}
              className="h-full group glass-card glass-card-hover smooth-lift rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-[#E4DEC3] flex flex-col justify-between cursor-pointer"
            >
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-teal-800 bg-teal-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-teal-200">
                    On-Device
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-base text-[#1B2A22] group-hover:text-teal-800 transition-colors flex items-center gap-1">
                    Label OCR
                    <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#5E6B63] mt-0.5 sm:mt-1 line-clamp-2">
                    Snap physical package labels to parse nutrition and ingredients locally.
                  </p>
                </div>
              </div>
            </Link>
          </ScrollReveal>

          {/* Card 4: Honest Compare */}
          <ScrollReveal delay={240} blur={8} yOffset={16} className="h-full">
            <Link
              href={user ? "/compare" : "/login?redirect=/compare"}
              className="h-full group glass-card glass-card-hover smooth-lift rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-[#E4DEC3] flex flex-col justify-between cursor-pointer"
            >
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-indigo-500/10 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <GitCompare className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-indigo-800 bg-indigo-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-indigo-200">
                    Objective
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-base text-[#1B2A22] group-hover:text-indigo-800 transition-colors flex items-center gap-1">
                    Product Compare
                    <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#5E6B63] mt-0.5 sm:mt-1 line-clamp-2">
                    Side-by-side metric comparison with strictly neutral statements.
                  </p>
                </div>
              </div>
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* 2. EVIDENCE-FIRST INSIGHT CARD (SAMPLE SECTION) */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6">
        <ScrollReveal blur={10} yOffset={20}>
          <div className="space-y-2 mb-4 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#1E5B45] uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              <span>Verifiable Provenance</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1B2A22]">
              Evidence-First Insight Card
            </h2>
            <p className="text-sm text-[#5E6B63] max-w-2xl">
              Every data field displays its exact provenance origin. Missing values are
              explicitly shown and never replaced with false zeros.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={120} blur={14} yOffset={28}>
          <SampleBanner customNotice="Sample, illustrative data, not a real product">
            <Card className="border border-[#E4DEC3] bg-white shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="space-y-3 pb-4 border-b border-[#E4DEC3]/60 bg-gradient-to-b from-[#FBF8F2] to-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#5E6B63] uppercase tracking-wider">
                    Fictional Product Demonstration
                  </span>
                  <ProvenanceBadge variant="source" />
                </div>
                <CardTitle className="text-2xl sm:text-3xl font-bold text-[#1B2A22]">
                  Sample Crunchy Snack (Herb &amp; Garlic)
                </CardTitle>
                <p className="text-xs sm:text-sm text-[#5E6B63]">
                  Brand: <span className="font-medium text-[#1B2A22]">Demo Naturals</span> · Barcode: <span className="font-mono">0000000000000</span>
                </p>
              </CardHeader>

              <CardContent className="pt-5 space-y-6">
                {/* Provenance examples */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#1B2A22]">
                      Nutrition per 100 g
                    </h3>
                    <span className="text-xs font-mono text-[#5E6B63]">Solid food basis</span>
                  </div>
                  <div className="rounded-xl border border-[#E4DEC3]/80 bg-[#FBF8F2]/60 overflow-hidden divide-y divide-[#E4DEC3]/60">
                    <DataRow
                      label="Energy"
                      value="1850 kJ (442 kcal)"
                      provenance="source"
                    />
                    <DataRow
                      label="Total Fat"
                      value="16.5"
                      unit="g"
                      provenance="source"
                    />
                    <DataRow
                      label="Saturated Fat"
                      value="2.1"
                      unit="g"
                      provenance="label"
                    />
                    <DataRow
                      label="Sugars"
                      value="3.2"
                      unit="g"
                      provenance="source"
                    />
                    <DataRow
                      label="Sodium (calculated from salt)"
                      value="420"
                      unit="mg"
                      provenance="derived"
                    />
                    <DataRow
                      label="Dietary Fiber"
                      value={null}
                      provenance="missing"
                    />
                    <DataRow
                      label="Potassium"
                      value={undefined}
                      provenance="missing"
                    />
                  </div>
                </div>

                <Separator className="bg-[#E4DEC3]/80" />

                {/* Ingredients & AI explanation block */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#1B2A22]">
                      Ingredient Breakdown
                    </h3>
                    <ProvenanceBadge variant="label" />
                  </div>
                  <p className="text-sm text-[#5E6B63] bg-[#FBF8F2] p-3.5 rounded-xl border border-[#E4DEC3] leading-relaxed">
                    Whole grain corn, vegetable oil (sunflower and canola), dehydrated garlic,
                    sea salt, yeast extract, parsley, citric acid.
                  </p>
                </div>

                <div className="space-y-2.5 rounded-xl bg-purple-50/70 border border-purple-200 p-4 sm:p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                      Educational AI Summary
                    </span>
                    <ProvenanceBadge variant="ai" />
                  </div>
                  <p className="text-sm text-purple-950 leading-relaxed">
                    Whole grain corn is the primary ingredient by weight. Yeast extract provides
                    savory umami flavor alongside dehydrated herbs. Citric acid acts as a natural
                    flavor tartness enhancer.
                  </p>
                </div>
              </CardContent>
            </Card>
          </SampleBanner>
        </ScrollReveal>
      </section>

      {/* 3. HOW PINFO WORKS (3 STEPS) */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <ScrollReveal blur={10} yOffset={20}>
          <div className="text-center space-y-3 mb-10">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E5B45] uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5" />
              <span>Simple &amp; Transparent</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1B2A22]">
              How Pinfo Works
            </h2>
            <p className="text-sm sm:text-base text-[#5E6B63] max-w-xl mx-auto">
              A three-step pipeline designed for clarity, verifiable provenance, and user privacy.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ScrollReveal delay={0} blur={10} yOffset={24} className="h-full">
            <Card className="h-full glass-card glass-card-hover smooth-lift border border-[#E4DEC3] rounded-2xl p-2 flex flex-col justify-between">
              <CardHeader className="space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E5B45] text-white font-black text-lg shadow-sm shadow-[#1E5B45]/20">
                  1
                </div>
                <CardTitle className="text-lg font-bold text-[#1B2A22]">
                  Scan or Snap
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#5E6B63] leading-relaxed">
                  Scan any barcode or capture nutrition and ingredient labels. Camera
                  frames and images never leave your browser device.
                </p>
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal delay={120} blur={10} yOffset={24} className="h-full">
            <Card className="h-full glass-card glass-card-hover smooth-lift border border-[#E4DEC3] rounded-2xl p-2 flex flex-col justify-between">
              <CardHeader className="space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E5B45] text-white font-black text-lg shadow-sm shadow-[#1E5B45]/20">
                  2
                </div>
                <CardTitle className="text-lg font-bold text-[#1B2A22]">
                  Trace Provenance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#5E6B63] leading-relaxed">
                  Pinfo tags every fact: Open Food Facts community entries, label OCR,
                  mathematically derived values, or missing information.
                </p>
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal delay={240} blur={10} yOffset={24} className="h-full">
            <Card className="h-full glass-card glass-card-hover smooth-lift border border-[#E4DEC3] rounded-2xl p-2 flex flex-col justify-between">
              <CardHeader className="space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E5B45] text-white font-black text-lg shadow-sm shadow-[#1E5B45]/20">
                  3
                </div>
                <CardTitle className="text-lg font-bold text-[#1B2A22]">
                  Understand Clearly
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#5E6B63] leading-relaxed">
                  Receive neutral, plain-language ingredient explanations. No health grades,
                  no morality verdicts, and no marketing hype.
                </p>
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>
      </section>

      {/* 4. COMPARISON PREVIEW (SAMPLE SECTION) */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6">
        <ScrollReveal blur={10} yOffset={20}>
          <div className="space-y-2 mb-4 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E5B45] uppercase tracking-wider">
              <GitCompare className="h-4 w-4" />
              <span>Honest Evaluation</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1B2A22]">
              Side-by-Side Comparison Preview
            </h2>
            <p className="text-sm text-[#5E6B63] max-w-2xl">
              Compare two products with neutral &quot;higher/lower per 100 g&quot; factual statements.
              Never labeled &quot;better/worse&quot; or &quot;healthy/unhealthy&quot;.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={120} blur={14} yOffset={28}>
          <SampleBanner customNotice="Sample, illustrative data, not a real product">
            <Card className="border border-[#E4DEC3] bg-white shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="pb-4 border-b border-[#E4DEC3]/60 bg-gradient-to-b from-[#FBF8F2] to-white">
                <CardTitle className="text-xl sm:text-2xl font-bold text-[#1B2A22]">
                  Comparison Preview (per 100 g)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#E4DEC3]/60 text-center sm:text-left">
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-[#1B2A22]">
                      Sample Snack A
                    </h3>
                    <span className="text-xs text-[#5E6B63]">Corn &amp; Oat Crisps</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-[#1B2A22]">
                      Sample Snack B
                    </h3>
                    <span className="text-xs text-[#5E6B63]">Baked Rice Cakes</span>
                  </div>
                </div>

                <div className="divide-y divide-[#E4DEC3]/60 text-sm">
                  <div className="grid grid-cols-2 py-3.5 gap-4">
                    <div>
                      <span className="text-xs text-[#5E6B63] block">Energy</span>
                      <span className="font-semibold text-[#1B2A22]">1850 kJ (442 kcal)</span>
                      <span className="text-xs text-[#1E5B45] font-medium block mt-0.5">
                        Higher energy per 100 g (+180 kJ)
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-[#5E6B63] block">Energy</span>
                      <span className="font-semibold text-[#1B2A22]">1670 kJ (399 kcal)</span>
                      <span className="text-xs text-[#5E6B63] block mt-0.5">
                        Lower energy per 100 g
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 py-3.5 gap-4">
                    <div>
                      <span className="text-xs text-[#5E6B63] block">Total Sugars</span>
                      <span className="font-semibold text-[#1B2A22]">3.2 g</span>
                      <span className="text-xs text-[#5E6B63] block mt-0.5">
                        Lower sugars per 100 g
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-[#5E6B63] block">Total Sugars</span>
                      <span className="font-semibold text-[#1B2A22]">7.8 g</span>
                      <span className="text-xs text-[#5E6B63] font-medium block mt-0.5">
                        Higher sugars per 100 g (+4.6 g)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 py-3.5 gap-4">
                    <div>
                      <span className="text-xs text-[#5E6B63] block">Sodium</span>
                      <span className="font-semibold text-[#1B2A22]">420 mg</span>
                      <span className="text-xs text-[#5E6B63] font-medium block mt-0.5">
                        Higher sodium per 100 g (+210 mg)
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-[#5E6B63] block">Sodium</span>
                      <span className="font-semibold text-[#1B2A22]">210 mg</span>
                      <span className="text-xs text-[#5E6B63] block mt-0.5">
                        Lower sodium per 100 g
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 py-3.5 gap-4">
                    <div>
                      <span className="text-xs text-[#5E6B63] block">Dietary Fiber</span>
                      <MissingChip label="Not listed" />
                    </div>
                    <div>
                      <span className="text-xs text-[#5E6B63] block">Dietary Fiber</span>
                      <span className="font-semibold text-[#1B2A22]">4.5 g</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </SampleBanner>
        </ScrollReveal>
      </section>

      {/* 5. TRANSPARENCY & TRUST SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6">
        <ScrollReveal blur={14} yOffset={32}>
          <div className="rounded-3xl border border-[#E4DEC3] bg-[#EFECE4]/50 p-6 md:p-10 space-y-8 shadow-xs">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1B2A22]">
                Transparency &amp; Trust Principles
              </h2>
              <p className="text-sm text-[#5E6B63]">
                We believe consumers deserve facts without patronizing opinions or hidden telemetry.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#1E5B45]">
                  <Database className="h-4 w-4" />
                  <span>Where Data Comes From</span>
                </div>
                <p className="text-xs sm:text-sm text-[#5E6B63] leading-relaxed">
                  Database entries are fetched from Open Food Facts, a free, community-built,
                  open database licensed under ODbL. Because data is community-contributed,
                  records may contain mistakes or omissions.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#1E5B45]">
                  <Sparkles className="h-4 w-4" />
                  <span>Source vs. Label vs. AI</span>
                </div>
                <p className="text-xs sm:text-sm text-[#5E6B63] leading-relaxed">
                  We strictly separate source database values, photo OCR extractions, and
                  large-language model explanations. AI is only used to summarize plain-language
                  culinary and functional roles of ingredients.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span>What Pinfo Cannot Do</span>
                </div>
                <p className="text-xs sm:text-sm text-[#5E6B63] leading-relaxed">
                  Pinfo cannot determine if a food is safe for your specific allergens,
                  diagnose metabolic conditions, or evaluate overall diet suitability.
                  Pinfo does not provide medical or clinical nutritional advice.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#1E5B45]">
                  <EyeOff className="h-4 w-4" />
                  <span>Privacy &amp; On-Device Processing</span>
                </div>
                <p className="text-xs sm:text-sm text-[#5E6B63] leading-relaxed">
                  Camera video feeds and uploaded label images are processed entirely within
                  your browser. Photos are never uploaded to our servers or stored on remote
                  disks. History stays in your local browser storage.
                </p>
              </div>
            </div>

            <Separator className="bg-[#E4DEC3]" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <Disclaimer />
              <Link
                href="/about"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E5B45] hover:underline shrink-0"
              >
                Read full methodology &amp; limits
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
