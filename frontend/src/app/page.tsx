import Link from "next/link";
import {
  ScanBarcode,
  Search,
  Camera,
  Database,
  Sparkles,
  EyeOff,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { MissingChip } from "@/components/MissingChip";
import { DataRow } from "@/components/DataRow";
import { SampleBanner } from "@/components/SampleBanner";
import { DisabledAction } from "@/components/DisabledAction";
import { Disclaimer } from "@/components/Disclaimer";

export default function HomePage() {
  return (
    <div className="space-y-16 pb-16">
      {/* a) & b) Headline & intro */}
      <section className="relative overflow-hidden pt-12 md:pt-20 px-4 sm:px-6 max-w-5xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1E5B45]/10 text-[#1E5B45] text-xs font-semibold tracking-wide uppercase border border-[#1E5B45]/20">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Evidence-Based Food Intelligence</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#1B2A22] max-w-4xl mx-auto leading-tight">
          Know what you eat. <br className="hidden sm:inline" />
          <span className="text-[#1E5B45]">Understand what you buy.</span>
        </h1>

        <p className="text-lg md:text-xl text-[#5E6B63] max-w-2xl mx-auto leading-relaxed">
          Ingrivo breaks down packaged food labels into plain English using
          transparent evidence. We distinguish verified database facts, parsed label
          text, and AI explanations—with zero moral judgments.
        </p>

        {/* c) Primary actions & d) Secondary action */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 max-w-2xl mx-auto">
          <DisabledAction
            label="Scan a barcode"
            explanation="Requires camera scanner (Phase 3)"
            icon={<ScanBarcode className="h-4 w-4" />}
            variant="primary"
          />
          <DisabledAction
            label="Search a product"
            explanation="Requires Open Food Facts search (Phase 3)"
            icon={<Search className="h-4 w-4" />}
            variant="secondary"
          />
          <DisabledAction
            label="Upload label photo"
            explanation="Requires on-device OCR (Phase 4)"
            icon={<Camera className="h-4 w-4" />}
            variant="outline"
          />
        </div>
      </section>

      {/* e) Sample insight card for a fictional product inside SampleBanner */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="space-y-3 mb-2">
          <h2 className="text-2xl font-bold text-[#1B2A22]">
            Evidence-First Insight Card
          </h2>
          <p className="text-sm text-[#5E6B63]">
            Every data field displays its exact provenance origin. Missing values are
            explicitly shown and never replaced with zeros.
          </p>
        </div>

        <SampleBanner customNotice="Sample, illustrative data, not a real product">
          <Card className="border border-[#E4DEC3] bg-white shadow-xs">
            <CardHeader className="space-y-2 pb-4 border-b border-[#E4DEC3]/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#5E6B63] uppercase tracking-wider">
                  Fictional Product Demonstration
                </span>
                <ProvenanceBadge variant="source" />
              </div>
              <CardTitle className="text-2xl font-bold text-[#1B2A22]">
                Sample Crunchy Snack (Herb & Garlic)
              </CardTitle>
              <p className="text-sm text-[#5E6B63]">
                Brand: <span className="font-medium text-[#1B2A22]">Demo Naturals</span> · Barcode: 0000000000000
              </p>
            </CardHeader>

            <CardContent className="pt-4 space-y-6">
              {/* Provenance examples */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[#1B2A22] mb-2">
                  Nutrition per 100 g
                </h3>
                <div className="rounded-lg border border-[#E4DEC3]/80 bg-[#FBF8F2]/60 overflow-hidden divide-y divide-[#E4DEC3]/60">
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
                  <h3 className="text-sm font-semibold text-[#1B2A22]">
                    Ingredient Breakdown
                  </h3>
                  <ProvenanceBadge variant="label" />
                </div>
                <p className="text-sm text-[#5E6B63] bg-[#FBF8F2] p-3 rounded-lg border border-[#E4DEC3]">
                  Whole grain corn, vegetable oil (sunflower and canola), dehydrated garlic,
                  sea salt, yeast extract, parsley, citric acid.
                </p>
              </div>

              <div className="space-y-2 rounded-lg bg-purple-50/60 border border-purple-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-900 uppercase tracking-wider">
                    Educational Summary
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
      </section>

      {/* f) "How it works" in three steps */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-3 mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1B2A22]">
            How Ingrivo Works
          </h2>
          <p className="text-sm md:text-base text-[#5E6B63] max-w-xl mx-auto">
            A three-step pipeline designed for clarity, verifiable provenance, and user privacy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border border-[#E4DEC3] bg-white shadow-xs">
            <CardHeader className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E5B45] text-white font-bold">
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

          <Card className="border border-[#E4DEC3] bg-white shadow-xs">
            <CardHeader className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E5B45] text-white font-bold">
                2
              </div>
              <CardTitle className="text-lg font-bold text-[#1B2A22]">
                Trace Provenance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#5E6B63] leading-relaxed">
                Ingrivo tags every fact: Open Food Facts community entries, label OCR,
                mathematically derived values, or missing information.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#E4DEC3] bg-white shadow-xs">
            <CardHeader className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E5B45] text-white font-bold">
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
        </div>
      </section>

      {/* g) Comparison preview using fictional sample data inside SampleBanner */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="space-y-3 mb-2">
          <h2 className="text-2xl font-bold text-[#1B2A22]">
            Side-by-Side Comparison Preview
          </h2>
          <p className="text-sm text-[#5E6B63]">
            Compare two products with neutral &quot;higher/lower per 100 g&quot; factual statements.
            Never labeled &quot;better/worse&quot; or &quot;healthy/unhealthy&quot;.
          </p>
        </div>

        <SampleBanner customNotice="Sample, illustrative data, not a real product">
          <Card className="border border-[#E4DEC3] bg-white shadow-xs">
            <CardHeader className="pb-4 border-b border-[#E4DEC3]/60">
              <CardTitle className="text-xl font-bold text-[#1B2A22]">
                Comparison Preview (per 100 g)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#E4DEC3]/60 text-center sm:text-left">
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-[#1B2A22]">
                    Sample Snack A
                  </h3>
                  <span className="text-xs text-[#5E6B63]">Corn & Oat Crisps</span>
                </div>
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-[#1B2A22]">
                    Sample Snack B
                  </h3>
                  <span className="text-xs text-[#5E6B63]">Baked Rice Cakes</span>
                </div>
              </div>

              <div className="divide-y divide-[#E4DEC3]/60 text-sm">
                <div className="grid grid-cols-2 py-3 gap-4">
                  <div>
                    <span className="text-xs text-[#5E6B63] block">Energy</span>
                    <span className="font-medium text-[#1B2A22]">1850 kJ (442 kcal)</span>
                    <span className="text-xs text-[#1E5B45] block mt-0.5">
                      Higher energy per 100 g (+180 kJ)
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-[#5E6B63] block">Energy</span>
                    <span className="font-medium text-[#1B2A22]">1670 kJ (399 kcal)</span>
                    <span className="text-xs text-[#5E6B63] block mt-0.5">
                      Lower energy per 100 g
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 py-3 gap-4">
                  <div>
                    <span className="text-xs text-[#5E6B63] block">Total Sugars</span>
                    <span className="font-medium text-[#1B2A22]">3.2 g</span>
                    <span className="text-xs text-[#5E6B63] block mt-0.5">
                      Lower sugars per 100 g
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-[#5E6B63] block">Total Sugars</span>
                    <span className="font-medium text-[#1B2A22]">7.8 g</span>
                    <span className="text-xs text-[#5E6B63] block mt-0.5">
                      Higher sugars per 100 g (+4.6 g)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 py-3 gap-4">
                  <div>
                    <span className="text-xs text-[#5E6B63] block">Sodium</span>
                    <span className="font-medium text-[#1B2A22]">420 mg</span>
                    <span className="text-xs text-[#5E6B63] block mt-0.5">
                      Higher sodium per 100 g (+210 mg)
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-[#5E6B63] block">Sodium</span>
                    <span className="font-medium text-[#1B2A22]">210 mg</span>
                    <span className="text-xs text-[#5E6B63] block mt-0.5">
                      Lower sodium per 100 g
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 py-3 gap-4">
                  <div>
                    <span className="text-xs text-[#5E6B63] block">Dietary Fiber</span>
                    <MissingChip label="Not listed" />
                  </div>
                  <div>
                    <span className="text-xs text-[#5E6B63] block">Dietary Fiber</span>
                    <span className="font-medium text-[#1B2A22]">4.5 g</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </SampleBanner>
      </section>

      {/* h) Trust section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl border border-[#E4DEC3] bg-[#EFECE4]/40 p-6 md:p-8 space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[#1B2A22]">
              Transparency & Trust Principles
            </h2>
            <p className="text-sm text-[#5E6B63]">
              We believe consumers deserve facts without patronizing opinions or hidden telemetry.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1E5B45]">
                <Database className="h-4 w-4" />
                <span>Where Data Comes From</span>
              </div>
              <p className="text-xs text-[#5E6B63] leading-relaxed">
                Database entries are fetched from Open Food Facts, a free, community-built,
                open database licensed under ODbL. Because data is community-contributed,
                records may contain mistakes or omissions.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1E5B45]">
                <Sparkles className="h-4 w-4" />
                <span>Source vs. Label vs. AI</span>
              </div>
              <p className="text-xs text-[#5E6B63] leading-relaxed">
                We strictly separate source database values, photo OCR extractions, and
                large-language model explanations. AI is only used to summarize plain-language
                culinary and functional roles of ingredients.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <span>What Ingrivo Cannot Do</span>
              </div>
              <p className="text-xs text-[#5E6B63] leading-relaxed">
                Ingrivo cannot determine if a food is safe for your specific allergens,
                diagnose metabolic conditions, or evaluate overall diet suitability.
                Ingrivo does not provide medical or clinical nutritional advice.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1E5B45]">
                <EyeOff className="h-4 w-4" />
                <span>Privacy & On-Device Processing</span>
              </div>
              <p className="text-xs text-[#5E6B63] leading-relaxed">
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E5B45] hover:underline shrink-0"
            >
              Read full methodology & limits
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
