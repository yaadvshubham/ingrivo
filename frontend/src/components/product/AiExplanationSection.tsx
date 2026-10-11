"use client";

import React, { useState } from "react";
import {
  Sparkles,
  AlertCircle,
  Clock,
  RotateCcw,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Product } from "@/lib/schemas/product";
import { ExplainResponse, ExplainRequestSource } from "@/lib/schemas/analysis";
import { explainProduct, ApiError } from "@/lib/api-client";

interface AiExplanationSectionProps {
  product: Product;
}

type AiUiState = "idle" | "loading" | "success" | "rate_limited" | "unavailable" | "invalid_output" | "not_configured";

export function AiExplanationSection({ product }: AiExplanationSectionProps) {
  const isLabelProduct = product.ref.startsWith("lb-");
  const storageKey = `ingrivo_explain_${product.ref}`;

  // Session-cached explanation state
  const [explanation, setExplanation] = useState<ExplainResponse | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(storageKey);
        if (cached) return JSON.parse(cached) as ExplainResponse;
      } catch {
        // Fallback
      }
    }
    return null;
  });

  const [uiState, setUiState] = useState<AiUiState>(() => (explanation ? "success" : "idle"));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSlow, setIsSlow] = useState<boolean>(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState<boolean>(false);

  const handleRequestExplanation = async () => {
    setUiState("loading");
    setErrorMessage(null);
    setIsSlow(false);

    let source: ExplainRequestSource;
    if (isLabelProduct) {
      source = {
        type: "label",
        evidence: {
          ref: product.ref,
          kind: product.kind,
          name: product.name,
          brand: product.brand,
          ingredients_text: product.ingredients.raw_text,
          nutrition_basis: product.nutrition.basis,
          serving_size: product.nutrition.serving_size,
          nutrient_rows: [
            { name: "Energy", value: product.nutrition.values.energy_kcal, unit: "kcal" },
            { name: "Total Sugars", value: product.nutrition.values.sugars, unit: "g" },
            { name: "Added Sugars", value: product.nutrition.values.added_sugars, unit: "g" },
            { name: "Total Fat", value: product.nutrition.values.fat, unit: "g" },
            { name: "Saturated Fat", value: product.nutrition.values.saturated_fat, unit: "g" },
            { name: "Carbohydrates", value: product.nutrition.values.carbohydrates, unit: "g" },
            { name: "Dietary Fibre", value: product.nutrition.values.fibre, unit: "g" },
            { name: "Protein", value: product.nutrition.values.protein, unit: "g" },
            { name: "Salt", value: product.nutrition.values.salt, unit: "g" },
            { name: "Sodium", value: product.nutrition.values.sodium, unit: "g" },
          ].filter((r) => r.value !== null && r.value !== undefined),
          allergens_declared: product.allergens.declared,
          allergens_traces: product.allergens.traces,
          user_confirmed: true,
        },
      };
    } else {
      source = {
        type: "barcode",
        barcode: product.ref.replace("bc-", ""),
      };
    }

    try {
      const result = await explainProduct(source, {
        timeoutMs: 30000,
        slowThresholdMs: 3500,
        onSlow: () => setIsSlow(true),
      });

      setExplanation(result);
      setUiState("success");
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(result));
      } catch {
        // Ignored
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === "AI_NOT_CONFIGURED") {
          setUiState("not_configured");
        } else if (err.code === "RATE_LIMITED") {
          setUiState("rate_limited");
        } else if (err.code === "AI_INVALID_OUTPUT") {
          setUiState("invalid_output");
        } else {
          setUiState("unavailable");
        }
        setErrorMessage(err.message);
      } else {
        setUiState("unavailable");
        setErrorMessage("An unexpected error occurred while contacting the AI service.");
      }
    }
  };

  const handleScrollToRef = (refPath: string) => {
    const cleanId = refPath.replace(/\./g, "-").toLowerCase();
    const target = document.getElementById(`row-${cleanId}`) || document.getElementById(cleanId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("bg-amber-100", "transition-colors");
      setTimeout(() => {
        target.classList.remove("bg-amber-100");
      }, 2000);
    }
  };

  return (
    <Card
      data-testid="ai-explanation-section"
      className="border border-[#E4DEC3] bg-white shadow-xs overflow-hidden"
    >
      <CardHeader className="py-4 px-6 bg-[#FBF8F2] border-b border-[#E4DEC3]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-[#1B2A22] flex items-center gap-2">
              <span>AI Product Explanation</span>
              <ProvenanceBadge variant="ai" />
            </CardTitle>
            <p className="text-xs text-[#5E6B63]">
              Simple, educational overview verified against packaging evidence.
            </p>
          </div>
        </div>

        {uiState === "success" && (
          <span className="text-[11px] text-[#5E6B63] font-mono">
            Model: {explanation?.model}
          </span>
        )}
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* State 1: Idle (Initial State before user click) */}
        {uiState === "idle" && (
          <div className="space-y-4 max-w-xl mx-auto text-center py-4">
            <p className="text-xs text-[#5E6B63] leading-relaxed">
              Get an objective, plain-English breakdown of key ingredients, nutritional context,
              and declared allergens. Explanations never invent facts and never provide medical verdicts.
            </p>

            <div className="pt-2">
              <Button
                id="btn-explain-product"
                type="button"
                variant="default"
                size="lg"
                onClick={handleRequestExplanation}
                className="h-11 px-6 bg-[#1E5B45] text-white hover:bg-[#1E5B45]/90 gap-2 shadow-xs"
              >
                <Sparkles className="h-4 w-4" />
                <span>Explain this product</span>
              </Button>
            </div>

            {/* Data-flow notice directly beside/below button */}
            <div
              data-testid="ai-data-flow-notice"
              className="mt-4 p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-left text-xs text-[#5E6B63] space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#1B2A22] flex items-center gap-1.5 text-[11px]">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                  Data Flow & Privacy Disclosure
                </span>
                <button
                  type="button"
                  onClick={() => setShowPrivacyDetails(!showPrivacyDetails)}
                  className="text-[11px] text-[#1E5B45] hover:underline flex items-center gap-0.5"
                >
                  <span>{showPrivacyDetails ? "Hide details" : "Learn more"}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${showPrivacyDetails ? "rotate-180" : ""}`} />
                </button>
              </div>

              <p className="text-[11px] leading-relaxed">
                {isLabelProduct
                  ? "Only the text and verified numbers you reviewed from the label are sent. Photos are never uploaded."
                  : "Only the barcode number is sent to our server to retrieve canonical database facts."}{" "}
                Data is transmitted to Google&apos;s Gemini API for structured explanation.
              </p>

              {showPrivacyDetails && (
                <div className="pt-1.5 border-t border-stone-200 text-[11px] space-y-1 text-stone-600">
                  <p>
                    Under Google&apos;s developer API terms, submitted prompts may be processed according to Google&apos;s Privacy Policy.
                  </p>
                  <p className="font-medium text-amber-900">
                    Please do not include personal names or sensitive information in custom product names or ingredient notes.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* State 2: Loading */}
        {uiState === "loading" && (
          <div className="py-8 text-center space-y-4 max-w-md mx-auto">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-700 animate-spin">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#1B2A22]">
                Analyzing packaging evidence...
              </p>
              <p className="text-xs text-[#5E6B63]">
                Verifying numbers and filtering for educational ingredient functions.
              </p>
            </div>

            {isSlow && (
              <div
                role="status"
                data-testid="ai-slow-notice"
                className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 text-left"
              >
                <Clock className="h-4 w-4 shrink-0 text-amber-700 animate-spin" />
                <span>
                  Waking up the server or awaiting model response; this may take a few moments...
                </span>
              </div>
            )}
          </div>
        )}

        {/* State 3: Success */}
        {uiState === "success" && explanation && (
          <div data-testid="ai-success-container" className="space-y-6">
            {/* Summary */}
            <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2">
              <h3 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                Summary
              </h3>
              <p className="text-xs text-purple-950 leading-relaxed font-medium">
                {explanation.summary}
              </p>
            </div>

            {/* Split Ingredient Notes */}
            {explanation.ingredient_notes.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#1B2A22] uppercase tracking-wider">
                  Ingredient Insights
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Product Evidence Notes */}
                  <div className="space-y-2.5">
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                      From this product&apos;s information
                    </span>
                    {explanation.ingredient_notes.filter((n) => n.basis === "product_evidence").length === 0 ? (
                      <p className="text-xs text-[#5E6B63] italic">No product-specific claims noted.</p>
                    ) : (
                      explanation.ingredient_notes
                        .filter((n) => n.basis === "product_evidence")
                        .map((note, idx) => (
                          <div
                            key={idx}
                            data-testid="note-product-evidence"
                            className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-1 text-xs"
                          >
                            <span className="font-bold text-emerald-950 block">{note.name}</span>
                            <p className="text-emerald-900 leading-relaxed">{note.explanation}</p>
                          </div>
                        ))
                    )}
                  </div>

                  {/* General Knowledge Notes */}
                  <div className="space-y-2.5">
                    <span className="text-[11px] font-semibold text-sky-800 uppercase tracking-wider block">
                      General knowledge about these ingredients
                    </span>
                    {explanation.ingredient_notes.filter((n) => n.basis === "general_knowledge").length === 0 ? (
                      <p className="text-xs text-[#5E6B63] italic">No general ingredient roles noted.</p>
                    ) : (
                      explanation.ingredient_notes
                        .filter((n) => n.basis === "general_knowledge")
                        .map((note, idx) => (
                          <div
                            key={idx}
                            data-testid="note-general-knowledge"
                            className="p-3 bg-sky-50/60 border border-sky-200 rounded-lg space-y-1 text-xs"
                          >
                            <span className="font-bold text-sky-950 block">{note.name}</span>
                            <p className="text-sky-900 leading-relaxed">{note.explanation}</p>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Observations with Clickable Evidence Chips */}
            {explanation.observations.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-[#1B2A22] uppercase tracking-wider">
                  Observations
                </h3>
                <div className="space-y-2">
                  {explanation.observations.map((obs, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs space-y-2"
                    >
                      <p className="text-[#1B2A22] leading-relaxed">{obs.text}</p>
                      {obs.evidence_refs.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-[#5E6B63]">Cited facts:</span>
                          {obs.evidence_refs.map((refPath, rIdx) => (
                            <button
                              key={rIdx}
                              type="button"
                              onClick={() => handleScrollToRef(refPath)}
                              className="text-[10px] font-mono px-2 py-0.5 bg-white border border-stone-300 rounded hover:bg-stone-100 text-[#1B2A22]"
                            >
                              {refPath}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Info & Caveats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {explanation.missing_info.length > 0 && (
                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-lg space-y-1 text-xs">
                  <span className="font-bold text-[#1B2A22] block text-[11px] uppercase tracking-wider">
                    Missing Information
                  </span>
                  <ul className="list-disc pl-4 space-y-1 text-[#5E6B63]">
                    {explanation.missing_info.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {explanation.caveats.length > 0 && (
                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-lg space-y-1 text-xs">
                  <span className="font-bold text-[#1B2A22] block text-[11px] uppercase tracking-wider">
                    Context & Caveats
                  </span>
                  <ul className="list-disc pl-4 space-y-1 text-[#5E6B63]">
                    {explanation.caveats.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Mandatory Educational Disclaimer */}
            <p className="text-[11px] text-[#5E6B63] italic border-t border-stone-200 pt-3">
              Generated by Google Gemini based on the evidence shown above. Educational overview only; not medical or dietary advice.
            </p>
          </div>
        )}

        {/* State 4: Rate Limited */}
        {uiState === "rate_limited" && (
          <div data-testid="ai-rate-limited-state" className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-700" />
              <span>Explanation limit reached</span>
            </div>
            <p className="text-xs text-amber-800 max-w-md mx-auto">
              You have reached the temporary limit (5 explanations per 10 minutes). The product facts above remain fully visible.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRequestExplanation}
              className="border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Try again
            </Button>
          </div>
        )}

        {/* State 5: AI Unavailable */}
        {uiState === "unavailable" && (
          <div data-testid="ai-unavailable-state" className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#1B2A22]">
              <AlertCircle className="h-4 w-4 text-[#5E6B63]" />
              <span>AI explanation temporarily unavailable</span>
            </div>
            <p className="text-xs text-[#5E6B63] max-w-md mx-auto">
              {errorMessage || "The AI service could not be reached. The facts above are unaffected."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRequestExplanation}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        )}

        {/* State 6: Invalid Output */}
        {uiState === "invalid_output" && (
          <div data-testid="ai-invalid-output-state" className="p-4 bg-amber-50/70 border border-amber-300 rounded-xl space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-700" />
              <span>Explanation verification failed</span>
            </div>
            <p className="text-xs text-amber-800 max-w-md mx-auto">
              We couldn&apos;t produce a reliable explanation; the facts above are unaffected.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRequestExplanation}
              className="border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        )}

        {/* State 7: Not Configured */}
        {uiState === "not_configured" && (
          <div data-testid="ai-not-configured-state" className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2 text-center">
            <p className="text-xs font-semibold text-[#1B2A22]">
              AI Explanations Not Configured
            </p>
            <p className="text-xs text-[#5E6B63]">
              The server does not have an active Gemini API key configured. Verified product facts above remain available.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
