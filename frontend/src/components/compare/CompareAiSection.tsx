"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, Clock, AlertCircle, Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import {
  CompareAiResponse,
  CompareRequest,
  CompareResponse,
} from "@/lib/schemas/compare";
import { compareProducts, ApiError } from "@/lib/api-client";

interface CompareAiSectionProps {
  refA: string;
  refB: string;
  requestPayload: CompareRequest;
  initialAi?: CompareAiResponse | null;
  initialStatus?: string;
}

export function CompareAiSection({
  refA,
  refB,
  requestPayload,
  initialAi,
  initialStatus,
}: CompareAiSectionProps) {
  const cacheKey = `ingrivo_compare_ai_${refA}_${refB}`;

  const [aiData, setAiData] = useState<CompareAiResponse | null>(() => {
    if (initialAi) return initialAi;
    if (typeof window !== "undefined") {
      try {
        const stored = window.sessionStorage.getItem(cacheKey);
        if (stored) return JSON.parse(stored);
      } catch {
        // Ignored
      }
    }
    return null;
  });

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "unavailable" | "failed" | "not_configured">(() => {
    if (initialAi) return "success";
    if (initialStatus === "failed") return "failed";
    if (initialStatus === "unavailable") return "unavailable";
    if (initialStatus === "not_configured") return "not_configured";
    if (typeof window !== "undefined") {
      try {
        const stored = window.sessionStorage.getItem(cacheKey);
        if (stored) return "success";
      } catch {
        // Ignored
      }
    }
    return "idle";
  });

  const [isSlow, setIsSlow] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExplain = async () => {
    setStatus("loading");
    setIsSlow(false);
    setErrorMessage(null);

    try {
      const res: CompareResponse = await compareProducts(
        {
          ...requestPayload,
          include_ai_explanation: true,
        },
        {
          timeoutMs: 30000,
          onSlow: () => setIsSlow(true),
        }
      );

      if (res.ai && res.ai_status === "available") {
        setAiData(res.ai);
        setStatus("success");
        try {
          window.sessionStorage.setItem(cacheKey, JSON.stringify(res.ai));
        } catch {
          // Ignored
        }
      } else if (res.ai_status === "failed") {
        setStatus("failed");
        setErrorMessage("We couldn't produce a reliable explanation; the comparison facts above are unaffected.");
      } else if (res.ai_status === "not_configured") {
        setStatus("not_configured");
        setErrorMessage("Gemini AI is not configured on this server.");
      } else {
        setStatus("unavailable");
        setErrorMessage("AI explanation is temporarily unavailable; facts above remain fully visible.");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === "AI_NOT_CONFIGURED") {
          setStatus("not_configured");
          setErrorMessage("Gemini AI explanations are not configured on this server.");
        } else if (err.code === "AI_INVALID_OUTPUT" || err.code === "SCHEMA_ERROR") {
          setStatus("failed");
          setErrorMessage("We couldn't produce a reliable explanation; the comparison facts above are unaffected.");
        } else {
          setStatus("unavailable");
          setErrorMessage(err.message || "AI service is temporarily unavailable.");
        }
      } else {
        setStatus("unavailable");
        setErrorMessage("An unexpected error occurred while contacting AI service.");
      }
    }
  };

  return (
    <Card className="border border-[#E4DEC3] bg-white shadow-2xs">
      <CardHeader className="pb-3 border-b border-[#E4DEC3]/60 flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold text-[#1B2A22]">
            AI Comparison Narrative
          </CardTitle>
          <p className="text-xs text-[#5E6B63]">
            Plain-English narrative describing computed differences. Zero moral verdicts or ranking.
          </p>
        </div>
        <ProvenanceBadge variant="ai" />
      </CardHeader>

      <CardContent className="pt-5 space-y-6">
        {/* State 1: Idle */}
        {status === "idle" && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#E4DEC3] bg-[#FBF8F2]/60">
            <div className="space-y-1.5 flex-1">
              <span className="text-xs font-bold text-[#1B2A22] block">
                Generate Factual AI Narrative
              </span>
              <p className="text-xs text-[#5E6B63] leading-relaxed">
                Clicking sends strictly the computed difference rows above to Google Gemini.
                Photos and personal identifiers are never transmitted. Free-tier terms apply.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleExplain}
              className="bg-[#1E5B45] hover:bg-[#1E5B45]/90 text-white gap-2 shrink-0"
            >
              <Sparkles className="h-4 w-4" />
              <span>Explain the differences</span>
            </Button>
          </div>
        )}

        {/* State 2: Loading */}
        {status === "loading" && (
          <div className="p-6 rounded-xl border border-[#E4DEC3] bg-[#FBF8F2] text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#1E5B45]">
              <Sparkles className="h-4 w-4 animate-spin text-[#1E5B45]" />
              <span>Analyzing computed comparison rows...</span>
            </div>
            {isSlow && (
              <p className="text-xs text-amber-800 flex items-center justify-center gap-1.5">
                <Clock className="h-3.5 w-3.5 animate-spin" />
                <span>Contacting AI model, this may take a few moments...</span>
              </p>
            )}
          </div>
        )}

        {/* State 3: Success */}
        {status === "success" && aiData && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                Comparison Summary
              </span>
              <p className="text-sm text-[#1B2A22] leading-relaxed">
                {aiData.summary}
              </p>
            </div>

            {/* Key Differences */}
            {aiData.differences.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#5E6B63]">
                  Key Observed Differences
                </h4>
                <div className="space-y-2">
                  {aiData.differences.map((diff, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-[#E4DEC3] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <span className="text-xs text-[#1B2A22] leading-relaxed flex-1">
                        {diff.text}
                      </span>
                      {diff.evidence_refs.length > 0 && (
                        <div className="flex flex-wrap gap-1 shrink-0">
                          {diff.evidence_refs.map((ref, rIdx) => (
                            <span
                              key={rIdx}
                              className="rounded bg-stone-100 border border-stone-200 px-1.5 py-0.5 text-[10px] font-mono text-[#5E6B63]"
                            >
                              {ref}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Limitations */}
            {aiData.limitations.length > 0 && (
              <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/50 space-y-1.5">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-amber-800" />
                  Comparison Limitations
                </span>
                <ul className="list-disc list-inside text-xs text-amber-900 space-y-0.5">
                  {aiData.limitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* State 4: Failed / Degraded */}
        {status === "failed" && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-800" />
              Unverified Output
            </span>
            <p className="text-xs text-amber-900">
              {errorMessage || "We couldn't produce a reliable explanation; the comparison facts above are unaffected."}
            </p>
          </div>
        )}

        {/* State 5: Unavailable */}
        {status === "unavailable" && (
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
            <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-stone-600" />
              AI Service Unavailable
            </span>
            <p className="text-xs text-[#5E6B63]">
              {errorMessage || "AI comparison narrative is temporarily unavailable; facts above remain fully visible."}
            </p>
          </div>
        )}

        {/* State 6: Not Configured */}
        {status === "not_configured" && (
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
            <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Info className="h-4 w-4 text-stone-600" />
              AI Not Configured
            </span>
            <p className="text-xs text-[#5E6B63]">
              Gemini AI is not configured on this server. Factual deterministic comparison above is unaffected.
            </p>
          </div>
        )}

        {/* Data flow notice */}
        <div className="border-t border-[#E4DEC3]/60 pt-3 flex flex-wrap items-center justify-between text-[11px] text-[#5E6B63] gap-2">
          <span>
            Data flow: Only computed difference rows sent to server & Gemini API. Never photos.
          </span>
          <Link href="/about" className="text-[#1E5B45] hover:underline inline-flex items-center gap-1">
            Read privacy methodology
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
