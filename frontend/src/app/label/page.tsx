"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  Upload,
  RotateCw,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowLeft,
  Plus,
  Trash2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  validateImageFile,
  processAndDownscaleImage,
  rotateCanvas,
  ImageValidationResult,
} from "@/lib/image-utils";
import { runOcr, OcrResult, OcrAbortError } from "@/lib/ocr";
import {
  parseLabelOcr,
  ParsedLabelResult,
  determineProvenance,
  runNutritionSanityChecks,
  ColumnData,
} from "@/lib/label-parser";
import { calculateCompleteness } from "@/lib/completeness";
import { saveLabelProduct } from "@/lib/label-store";
import { Product, NutritionBasis, NutrientValues } from "@/lib/schemas/product";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type LabelFlowStep = "intake" | "processing" | "review";

interface FormNutrientItem {
  id: string;
  name: string;
  key?: keyof NutrientValues;
  valueStr: string;
  unit: string;
  isSuspect: boolean;
  isCustom?: boolean;
}

export default function LabelPage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<LabelFlowStep>("intake");

  // Intake State
  const [activeCanvas, setActiveCanvas] = useState<HTMLCanvasElement | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [intakeWarning, setIntakeWarning] = useState<string | null>(null);

  // OCR Processing State
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrStatusText, setOcrStatusText] = useState<string>("Initializing engine...");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Review Form State
  const [parsedResult, setParsedResult] = useState<ParsedLabelResult | null>(null);
  const [chosenColumnIndex, setChosenColumnIndex] = useState<number | null>(null);

  const [formName, setFormName] = useState<string>("");
  const [formBrand, setFormBrand] = useState<string>("");
  const [formBasis, setFormBasis] = useState<NutritionBasis | "">("");
  const [formServingSize, setFormServingSize] = useState<string>("");
  const [formIngredients, setFormIngredients] = useState<string>("");
  const [formDeclaredAllergens, setFormDeclaredAllergens] = useState<string>("");
  const [formTracesAllergens, setFormTracesAllergens] = useState<string>("");

  const [nutrientItems, setNutrientItems] = useState<FormNutrientItem[]>([]);
  const [sanityWarnings, setSanityWarnings] = useState<string[]>([]);
  const [userConfirmedCheck, setUserConfirmedCheck] = useState<boolean>(false);

  // File input refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [imagePreviewUrl]);

  // Update image preview URL whenever activeCanvas changes
  const updateCanvasPreview = (canvas: HTMLCanvasElement) => {
    setActiveCanvas(canvas);
    try {
      const dataUrl = canvas.toDataURL("image/jpeg");
      if (dataUrl && dataUrl.startsWith("data:")) {
        setImagePreviewUrl(dataUrl);
        return;
      }
    } catch {
      // Fallback to toBlob
    }
    canvas.toBlob((blob) => {
      if (blob) {
        if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
        const url = URL.createObjectURL(blob);
        setImagePreviewUrl(url);
      }
    }, "image/jpeg", 0.9);
  };

  // Handle image file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIntakeError(null);
    setIntakeWarning(null);

    // 1. Validate file (type, magic bytes, size, HEIC)
    const validation: ImageValidationResult = await validateImageFile(file);
    if (!validation.valid) {
      setIntakeError(validation.error || "Invalid file format.");
      return;
    }

    try {
      // 2. Decode with createImageBitmap & downscale max 2000px
      const { canvas, warning } = await processAndDownscaleImage(file);
      if (warning) {
        setIntakeWarning(warning);
      }
      updateCanvasPreview(canvas);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to decode image.";
      setIntakeError(msg);
    }
  };

  // Rotation handlers
  const handleRotate = (degrees: 90 | -90) => {
    if (!activeCanvas) return;
    const rotated = rotateCanvas(activeCanvas, degrees);
    updateCanvasPreview(rotated);
  };

  // Start OCR
  const startOcrProcessing = async () => {
    if (!activeCanvas) return;

    setStep("processing");
    setOcrProgress(0);
    setOcrStatusText("Starting on-device OCR engine...");
    setOcrError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result: OcrResult = await runOcr(activeCanvas, {
        signal: controller.signal,
        timeoutMs: 60000,
        onProgress: (prog, status) => {
          setOcrProgress(Math.round(prog * 100));
          setOcrStatusText(status);
        },
      });

      // Parse OCR text into sections, nutrition, allergens
      const parsed = parseLabelOcr(result.fullText, result.words);
      setParsedResult(parsed);

      initializeReviewForm(parsed);
      setStep("review");
    } catch (err: unknown) {
      if (err instanceof OcrAbortError) {
        // User canceled, go back to intake
        setStep("intake");
        return;
      }
      const msg = err instanceof Error ? err.message : "OCR processing encountered an error.";
      setOcrError(msg);
    }
  };

  // Cancel OCR
  const handleCancelOcr = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStep("intake");
  };

  // Fallback to manual entry on error
  const handleManualEntryFallback = () => {
    const emptyParsed: ParsedLabelResult = {
      rawText: "",
      sections: { rawText: "", ingredientsText: null, allergenText: null, nutritionText: null },
      nutrition: {
        detected_basis: "unknown",
        serving_size: null,
        needs_column_choice: false,
        columns: [],
        unmapped_rows: [],
        warnings: [],
        all_numeric_tokens: [],
      },
      allergens: { declared: [], traces: [], declaredText: "", tracesText: "" },
      detected_name: null,
      detected_brand: null,
    };
    setParsedResult(emptyParsed);
    initializeReviewForm(emptyParsed);
    setStep("review");
  };

  // Initialize form fields from parsed OCR result
  const initializeReviewForm = (parsed: ParsedLabelResult, colIndexOverride?: number) => {
    setFormName(parsed.detected_name || "");
    setFormBrand(parsed.detected_brand || "");
    setFormIngredients(parsed.sections.ingredientsText || "");
    setFormDeclaredAllergens(parsed.allergens.declaredText || parsed.allergens.declared.join(", "));
    setFormTracesAllergens(parsed.allergens.tracesText || parsed.allergens.traces.join(", "));

    const colIdx =
      colIndexOverride !== undefined
        ? colIndexOverride
        : parsed.nutrition.needs_column_choice
        ? null
        : 0;

    setChosenColumnIndex(colIdx);

    const activeCol: ColumnData | undefined =
      colIdx !== null ? parsed.nutrition.columns[colIdx] : undefined;

    if (activeCol) {
      setFormBasis(activeCol.basis);
      setFormServingSize(activeCol.serving_size || parsed.nutrition.serving_size || "");
    } else if (parsed.nutrition.columns.length === 0) {
      setFormBasis("unknown");
      setFormServingSize("");
    } else {
      // Must choose column: reset basis until chosen
      setFormBasis("");
      setFormServingSize("");
    }

    // Standard nutrient fields
    const standardKeys: Array<{ key: keyof NutrientValues; name: string; unit: string }> = [
      { key: "energy_kcal", name: "Energy (kcal)", unit: "kcal" },
      { key: "energy_kj", name: "Energy (kJ)", unit: "kJ" },
      { key: "fat", name: "Total Fat", unit: "g" },
      { key: "saturated_fat", name: "Saturated Fat", unit: "g" },
      { key: "carbohydrates", name: "Carbohydrates", unit: "g" },
      { key: "sugars", name: "Total Sugars", unit: "g" },
      { key: "added_sugars", name: "Added Sugars", unit: "g" },
      { key: "fibre", name: "Dietary Fibre", unit: "g" },
      { key: "protein", name: "Protein", unit: "g" },
      { key: "salt", name: "Salt", unit: "g" },
      { key: "sodium", name: "Sodium", unit: "g" },
    ];

    const items: FormNutrientItem[] = standardKeys.map((sk) => {
      const val = activeCol?.values[sk.key];
      const isSus = activeCol?.suspect_fields.includes(sk.name) || false;
      return {
        id: sk.key,
        name: sk.name,
        key: sk.key,
        valueStr: val !== null && val !== undefined ? String(val) : "",
        unit: sk.unit,
        isSuspect: isSus,
      };
    });

    // Append unmapped rows if any
    if (parsed.nutrition.unmapped_rows.length > 0) {
      parsed.nutrition.unmapped_rows.forEach((ur, i) => {
        items.push({
          id: `unmapped_${i}`,
          name: ur.name,
          valueStr: ur.valueStr,
          unit: ur.unitStr || "g",
          isSuspect: ur.ocr_suspect,
          isCustom: true,
        });
      });
    }

    setNutrientItems(items);

    if (activeCol) {
      const checks = runNutritionSanityChecks(activeCol.values, activeCol.basis);
      setSanityWarnings(checks);
    } else {
      setSanityWarnings([]);
    }
  };

  // When user switches column choice
  const handleColumnSelect = (colIndex: number) => {
    if (!parsedResult) return;
    initializeReviewForm(parsedResult, colIndex);
  };

  // Re-run sanity checks on nutrient changes
  const updateNutrientValue = (id: string, val: string) => {
    setNutrientItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, valueStr: val } : it))
    );

    // Compute updated values for sanity checks
    const updatedValues: ColumnData["values"] = {
      energy_kcal: null,
      energy_kj: null,
      sugars: null,
      added_sugars: null,
      protein: null,
      fat: null,
      saturated_fat: null,
      carbohydrates: null,
      fibre: null,
      sodium: null,
      salt: null,
    };

    nutrientItems.forEach((it) => {
      const v = it.id === id ? parseFloat(val) : parseFloat(it.valueStr);
      if (!isNaN(v) && it.key) {
        updatedValues[it.key] = v;
      }
    });

    if (formBasis && formBasis !== "unknown") {
      const checks = runNutritionSanityChecks(updatedValues, formBasis as NutritionBasis);
      setSanityWarnings(checks);
    }
  };

  // Add custom nutrient row
  const handleAddNutrientRow = () => {
    setNutrientItems((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        name: "New Nutrient",
        valueStr: "",
        unit: "g",
        isSuspect: false,
        isCustom: true,
      },
    ]);
  };

  // Remove custom nutrient row
  const handleRemoveNutrientRow = (id: string) => {
    setNutrientItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Gating validation
  const needsColumnChoice = Boolean(parsedResult?.nutrition.needs_column_choice);
  const hasColumnSelected = !needsColumnChoice || chosenColumnIndex !== null;
  const hasBasisSelected = Boolean(formBasis && formBasis.length > 0);
  const canSubmit = hasBasisSelected && hasColumnSelected && userConfirmedCheck;

  // Final confirmation: build label product and navigate
  const handleUseInformation = () => {
    if (!canSubmit || !parsedResult) return;

    const ref = `lb-${crypto.randomUUID()}`;

    // Compute nutrient numbers
    const nutrientValues: NutrientValues = {
      energy_kcal: null,
      energy_kj: null,
      sugars: null,
      added_sugars: null,
      protein: null,
      fat: null,
      saturated_fat: null,
      carbohydrates: null,
      fibre: null,
      sodium: null,
      salt: null,
    };

    nutrientItems.forEach((it) => {
      const num = parseFloat(it.valueStr);
      if (!isNaN(num) && it.key) {
        nutrientValues[it.key] = num;
      }
    });

    // Parse ingredients items from text
    const cleanIngText = formIngredients.trim() || null;
    const ingItems: string[] = cleanIngText
      ? cleanIngText
          .split(/[,;\n]/)
          .map((i) => i.trim().replace(/^\*\s*/, ""))
          .filter((i) => i.length > 1)
      : [];

    // Parse allergens
    const declaredList = formDeclaredAllergens
      .split(/[,;]/)
      .map((a) => a.trim())
      .filter(Boolean);

    const tracesList = formTracesAllergens
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean);

    // Compute field provenances
    const nameProv = determineProvenance(parsedResult.detected_name, formName || null);
    const brandProv = determineProvenance(parsedResult.detected_brand, formBrand || null);
    const ingProv = determineProvenance(parsedResult.sections.ingredientsText, cleanIngText);

    const originalCol =
      chosenColumnIndex !== null ? parsedResult.nutrition.columns[chosenColumnIndex] : undefined;

    const hasAnyNutrient = Object.values(nutrientValues).some((v) => v !== null && v !== undefined);
    const nutrProv = hasAnyNutrient
      ? originalCol
        ? determineProvenance(originalCol.values, nutrientValues)
        : "user_corrected"
      : "missing";

    const allgProv =
      declaredList.length > 0 || tracesList.length > 0
        ? determineProvenance(parsedResult.allergens.declared, declaredList)
        : "missing";

    // Completeness calculation
    const completeness = calculateCompleteness({
      name: formName || null,
      brand: formBrand || null,
      ingredients_text: cleanIngText,
      energy_kcal: nutrientValues.energy_kcal,
      energy_kj: nutrientValues.energy_kj,
      sugars: nutrientValues.sugars,
      protein: nutrientValues.protein,
      fat: nutrientValues.fat,
      saturated_fat: nutrientValues.saturated_fat,
      carbohydrates: nutrientValues.carbohydrates,
      fibre: nutrientValues.fibre,
      sodium: nutrientValues.sodium,
      salt: nutrientValues.salt,
      basis: formBasis,
    });

    const labelProduct: Product = {
      ref,
      kind: "label_product",
      name: formName.trim() || null,
      name_provenance: nameProv,
      brand: formBrand.trim() || null,
      brand_provenance: brandProv,
      quantity: formServingSize.trim() || null,
      quantity_provenance: formServingSize ? "ocr" : "missing",
      image_url: null,
      image_provenance: "missing",
      categories: [],
      categories_provenance: "missing",

      ingredients: {
        raw_text: cleanIngText,
        items: ingItems,
        language: "en",
        provenance: ingProv,
      },
      nutrition: {
        basis: (formBasis as NutritionBasis) || "unknown",
        serving_size: formServingSize.trim() || null,
        values: nutrientValues,
        provenance: nutrProv,
      },
      allergens: {
        declared: declaredList,
        traces: tracesList,
        provenance: allgProv,
      },

      source: null,
      completeness,
      source_computed: {
        nutriscore: null,
        nova_group: null,
        additive_tags: [],
      },
    };

    // Save text-only product into sessionStorage
    saveLabelProduct(labelProduct);

    // Revoke any canvas / object URLs
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    setActiveCanvas(null);

    // Navigate to product page
    router.push(`/product/${ref}`);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/scan"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5E6B63] hover:text-[#1E5B45] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to barcode scan
        </Link>
      </div>

      {/* Screen 1: Image Intake */}
      {step === "intake" && (
        <div className="space-y-8 max-w-2xl mx-auto">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1B2A22]">
              Scan Food Label Photo
            </h1>
            <p className="text-sm text-[#5E6B63] leading-relaxed">
              Take a photo or upload an image of the nutrition facts or ingredient label.
              All OCR processing runs securely on your device.
            </p>
          </div>

          {/* Privacy text notice */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-[#1E5B45] shrink-0" />
            <span>Your photo is read on your device. It isn&apos;t uploaded or stored.</span>
          </div>

          {/* Intake Errors and Warnings */}
          {intakeError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{intakeError}</span>
            </div>
          )}

          {intakeWarning && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <span>{intakeWarning}</span>
            </div>
          )}

          {/* Image Selection Actions */}
          {!imagePreviewUrl ? (
            <Card className="border border-[#E4DEC3] bg-white shadow-xs">
              <CardContent className="pt-8 pb-8 space-y-6 text-center">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  {/* Take Photo */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    type="button"
                    variant="default"
                    size="lg"
                    className="w-full sm:w-auto h-12 px-6 gap-2"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-5 w-5" />
                    <span>Take photo with camera</span>
                  </Button>

                  {/* Upload Image */}
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto h-12 px-6 gap-2"
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    <Upload className="h-5 w-5" />
                    <span>Upload image file</span>
                  </Button>
                </div>
                <p className="text-xs text-[#5E6B63]">
                  Accepts JPEG, PNG, and WebP (up to 10 MB).
                </p>
              </CardContent>
            </Card>
          ) : (
            /* Selected Photo Preview & Rotation */
            <Card className="border border-[#E4DEC3] bg-white shadow-xs">
              <CardHeader className="pb-3 border-b border-[#E4DEC3]/60 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-[#1B2A22]">
                  Photo Preview
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs gap-1"
                    onClick={() => handleRotate(-90)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Rotate Left</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs gap-1"
                    onClick={() => handleRotate(90)}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    <span>Rotate Right</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="relative max-h-96 w-full rounded-xl bg-stone-50 border border-[#E4DEC3] overflow-hidden flex items-center justify-center p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt="Uploaded food package label"
                    className="max-h-80 max-w-full object-contain rounded-lg"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="default"
                    size="lg"
                    className="w-full sm:w-auto h-12 px-8 gap-2"
                    onClick={startOcrProcessing}
                  >
                    <Sparkles className="h-5 w-5" />
                    <span>Read label text (OCR)</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto h-12"
                    onClick={() => {
                      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
                      setImagePreviewUrl(null);
                      setActiveCanvas(null);
                    }}
                  >
                    Choose another photo
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Photo tips */}
          <div className="rounded-xl border border-[#E4DEC3] bg-[#FBF8F2] p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1B2A22]">
              <Info className="h-4 w-4 text-[#1E5B45]" />
              <span>Tips for accurate text extraction</span>
            </div>
            <ul className="text-xs text-[#5E6B63] space-y-1.5 list-disc pl-5 leading-relaxed">
              <li>Place package on a flat, well-lit surface.</li>
              <li>Avoid flash glare or harsh shadows over nutrition tables.</li>
              <li>Fill the frame with the ingredients list and nutrition facts panel.</li>
              <li>Keep the camera steady and parallel to the label text.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Screen 2: OCR In-Progress & Error Recovery */}
      {step === "processing" && (
        <div className="max-w-xl mx-auto py-12 space-y-6 text-center">
          <Card className="border border-[#E4DEC3] bg-white shadow-xs">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl font-bold text-[#1B2A22]">
                {ocrError ? "OCR Processing Failed" : "Reading Package Label"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!ocrError ? (
                <>
                  <div className="w-full bg-[#EFECE4] rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-[#1E5B45] h-full transition-all duration-300"
                      style={{ width: `${Math.max(5, ocrProgress)}%` }}
                    />
                  </div>

                  <div
                    role="status"
                    aria-live="polite"
                    className="text-xs font-medium text-[#5E6B63] space-y-1"
                  >
                    <p className="text-sm font-semibold text-[#1B2A22]">
                      {ocrProgress}% complete
                    </p>
                    <p>{ocrStatusText}</p>
                  </div>

                  <p className="text-xs text-[#5E6B63]">
                    Running Tesseract OCR entirely in your browser using local WASM engines.
                  </p>

                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelOcr}
                      className="h-10 px-6"
                    >
                      Cancel OCR
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-3 text-left">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{ocrError}</span>
                  </div>

                  <p className="text-xs text-[#5E6B63] leading-relaxed">
                    You can try again with a clearer photo, or enter the product details manually
                    in the review screen.
                  </p>

                  <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <Button
                      type="button"
                      variant="default"
                      onClick={handleManualEntryFallback}
                    >
                      Type details manually
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep("intake")}
                    >
                      Try another photo
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Screen 3: Review & Edit Screen */}
      {step === "review" && (
        <div className="space-y-8">
          <div className="border-b border-[#E4DEC3] pb-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1B2A22]">
              Review Label Information
            </h1>
            <p className="text-sm text-[#5E6B63] mt-1">
              Check OCR-extracted data against your physical package. Edit any fields that need correction.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Photo Preview (Desktop side-by-side, mobile stacked) */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
              <Card className="border border-[#E4DEC3] bg-white shadow-xs overflow-hidden">
                <CardHeader className="py-3 px-4 bg-[#FBF8F2] border-b border-[#E4DEC3]/60 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold text-[#1B2A22] uppercase tracking-wider">
                    Label Photo Reference
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-[#5E6B63]"
                    onClick={() => setStep("intake")}
                  >
                    Change photo
                  </Button>
                </CardHeader>
                <CardContent className="p-3">
                  {imagePreviewUrl ? (
                    <div className="relative max-h-[500px] w-full rounded-lg bg-stone-50 overflow-auto flex items-center justify-center p-1 border border-stone-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreviewUrl}
                        alt="Scanned packaging label reference"
                        className="max-h-[460px] w-auto object-contain rounded"
                      />
                    </div>
                  ) : (
                    <div className="h-44 bg-stone-100 rounded-lg flex items-center justify-center text-xs text-[#5E6B63]">
                      No photo available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sanity Warnings Alert */}
              {sanityWarnings.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                    <span>Worth double-checking against the label:</span>
                  </div>
                  <ul className="text-xs text-amber-900 space-y-1 list-disc pl-5">
                    {sanityWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right Column: Review & Form Editing */}
            <div className="lg:col-span-7 space-y-6">
              {/* Product Identity */}
              <Card className="border border-[#E4DEC3] bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-[#E4DEC3]/60">
                  <CardTitle className="text-base font-bold text-[#1B2A22]">
                    Product Identity (Optional)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="label-product-name"
                      className="text-xs font-semibold text-[#1B2A22]"
                    >
                      Product Name
                    </label>
                    <Input
                      id="label-product-name"
                      maxLength={100}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Multigrain Crackers"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="label-product-brand"
                      className="text-xs font-semibold text-[#1B2A22]"
                    >
                      Brand
                    </label>
                    <Input
                      id="label-product-brand"
                      maxLength={100}
                      value={formBrand}
                      onChange={(e) => setFormBrand(e.target.value)}
                      placeholder="e.g. Nature Valley"
                      className="h-10"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Nutrition Column Choice (When two columns exist, MUST choose) */}
              {needsColumnChoice && (
                <Card className="border-2 border-emerald-600 bg-emerald-50/40 shadow-xs">
                  <CardHeader className="pb-3 border-b border-emerald-200">
                    <CardTitle className="text-base font-bold text-emerald-950 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-emerald-700" />
                      <span>Choose Nutrition Column (Required)</span>
                    </CardTitle>
                    <p className="text-xs text-emerald-800">
                      Two value columns were detected on your label. Choose which column you want to use.
                    </p>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {parsedResult?.nutrition.columns.map((col, idx) => {
                        const isSelected = chosenColumnIndex === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleColumnSelect(idx)}
                            className={`p-3.5 rounded-xl border text-left transition-all ${
                              isSelected
                                ? "border-[#1E5B45] bg-[#1E5B45] text-white shadow-xs"
                                : "border-[#E4DEC3] bg-white text-[#1B2A22] hover:border-[#1E5B45]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs uppercase tracking-wider">
                                {col.label}
                              </span>
                              {isSelected && <CheckCircle2 className="h-4 w-4" />}
                            </div>
                            <span
                              className={`text-[11px] block mt-1 ${
                                isSelected ? "text-emerald-100" : "text-[#5E6B63]"
                              }`}
                            >
                              Basis: {col.basis}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Nutrition Basis Selector */}
              <Card className="border border-[#E4DEC3] bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-[#E4DEC3]/60">
                  <CardTitle className="text-base font-bold text-[#1B2A22]">
                    Nutrition Basis
                  </CardTitle>
                  <p className="text-xs text-[#5E6B63]">
                    Select the quantity basis matching your packaging table.
                  </p>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { val: "per_100g", label: "Per 100 g" },
                      { val: "per_100ml", label: "Per 100 ml" },
                      { val: "per_serving", label: "Per Serving" },
                      { val: "unknown", label: "Not Stated" },
                    ].map((b) => (
                      <button
                        key={b.val}
                        type="button"
                        onClick={() => setFormBasis(b.val as NutritionBasis)}
                        className={`p-2.5 rounded-lg border text-xs font-medium text-center transition-colors ${
                          formBasis === b.val
                            ? "border-[#1E5B45] bg-[#1E5B45] text-white"
                            : "border-[#E4DEC3] bg-[#FBF8F2] text-[#1B2A22] hover:border-[#1E5B45]"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {formBasis === "per_serving" && (
                    <div className="space-y-1.5 pt-1">
                      <label
                        htmlFor="serving-size-input"
                        className="text-xs font-semibold text-[#1B2A22]"
                      >
                        Serving Size Description
                      </label>
                      <Input
                        id="serving-size-input"
                        value={formServingSize}
                        onChange={(e) => setFormServingSize(e.target.value)}
                        placeholder="e.g. 30g, 1 biscuit, 250ml"
                        className="h-10"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ingredients */}
              <Card className="border border-[#E4DEC3] bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-[#E4DEC3]/60">
                  <CardTitle className="text-base font-bold text-[#1B2A22]">
                    Ingredients List
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                  <textarea
                    id="label-ingredients-textarea"
                    rows={4}
                    value={formIngredients}
                    onChange={(e) => setFormIngredients(e.target.value)}
                    placeholder="Enter or edit ingredients list..."
                    className="w-full p-3 rounded-lg border border-[#E4DEC3] bg-[#FBF8F2] text-xs text-[#1B2A22] leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#1E5B45]"
                  />
                  <p className="text-[11px] text-[#5E6B63]">
                    Separate items with commas. Missing or illegible ingredients will not be inferred.
                  </p>
                </CardContent>
              </Card>

              {/* Allergens */}
              <Card className="border border-[#E4DEC3] bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-[#E4DEC3]/60">
                  <CardTitle className="text-base font-bold text-[#1B2A22]">
                    Allergen Declarations
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="allergens-declared-input"
                      className="text-xs font-semibold text-[#1B2A22]"
                    >
                      Contains (Declared Allergens)
                    </label>
                    <Input
                      id="allergens-declared-input"
                      value={formDeclaredAllergens}
                      onChange={(e) => setFormDeclaredAllergens(e.target.value)}
                      placeholder="e.g. Milk, Wheat, Soy"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="allergens-traces-input"
                      className="text-xs font-semibold text-[#1B2A22]"
                    >
                      May contain traces of
                    </label>
                    <Input
                      id="allergens-traces-input"
                      value={formTracesAllergens}
                      onChange={(e) => setFormTracesAllergens(e.target.value)}
                      placeholder="e.g. Peanuts, Tree Nuts"
                      className="h-10"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Nutrition Values Table Form */}
              <Card className="border border-[#E4DEC3] bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-[#E4DEC3]/60 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-[#1B2A22]">
                      Nutrition Table
                    </CardTitle>
                    <p className="text-xs text-[#5E6B63]">
                      Suspect OCR readings are highlighted. Edit numbers to match physical packaging.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={handleAddNutrientRow}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Row</span>
                  </Button>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="divide-y divide-[#E4DEC3]/60">
                    {nutrientItems.map((item) => (
                      <div
                        key={item.id}
                        className={`py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                          item.isSuspect ? "bg-amber-50/70 p-2 rounded-lg" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          {item.isCustom ? (
                            <Input
                              value={item.name}
                              onChange={(e) => {
                                const newName = e.target.value;
                                setNutrientItems((prev) =>
                                  prev.map((it) =>
                                    it.id === item.id ? { ...it, name: newName } : it
                                  )
                                );
                              }}
                              className="h-8 text-xs max-w-44"
                            />
                          ) : (
                            <span className="text-xs font-medium text-[#1B2A22]">
                              {item.name}
                            </span>
                          )}

                          {item.isSuspect && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-100 text-amber-900 border-amber-300 font-semibold"
                            >
                              Suspect OCR reading
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={item.valueStr}
                            onChange={(e) => updateNutrientValue(item.id, e.target.value)}
                            placeholder="empty"
                            className={`h-8 w-24 text-right text-xs font-mono ${
                              item.isSuspect ? "border-amber-400 focus:ring-amber-500" : ""
                            }`}
                          />
                          <span className="text-xs text-[#5E6B63] w-10">{item.unit}</span>

                          {item.isCustom && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-stone-400 hover:text-red-600"
                              onClick={() => handleRemoveNutrientRow(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Review Gating Confirmation Checkbox & Submission */}
              <Card className="border border-[#E4DEC3] bg-white shadow-xs">
                <CardContent className="pt-6 space-y-6">
                  <div className="flex items-start gap-3 p-4 bg-[#FBF8F2] border border-[#E4DEC3] rounded-xl">
                    <input
                      id="confirm-label-check"
                      type="checkbox"
                      checked={userConfirmedCheck}
                      onChange={(e) => setUserConfirmedCheck(e.target.checked)}
                      className="h-4 w-4 rounded border-stone-300 text-[#1E5B45] focus:ring-[#1E5B45] mt-0.5 cursor-pointer"
                    />
                    <label
                      htmlFor="confirm-label-check"
                      className="text-xs font-medium text-[#1B2A22] leading-relaxed cursor-pointer select-none"
                    >
                      I have checked this against the label on the physical package.
                    </label>
                  </div>

                  {!hasBasisSelected && (
                    <p className="text-xs text-amber-800">
                      Please select a nutrition basis (Per 100g, Per 100ml, Per Serving, or Not Stated) before continuing.
                    </p>
                  )}

                  {needsColumnChoice && !hasColumnSelected && (
                    <p className="text-xs text-amber-800">
                      Please choose which nutrition column to use from the options above.
                    </p>
                  )}

                  <Button
                    id="use-label-info"
                    type="button"
                    variant="default"
                    size="lg"
                    disabled={!canSubmit}
                    onClick={handleUseInformation}
                    className="w-full h-12 text-sm font-bold gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Use this information</span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
