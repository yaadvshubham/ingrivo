import { extractSections, ExtractedSections } from "./sections";
import { parseNutritionText, ParsedNutrition } from "./nutrition";
import { parseAllergens, ParsedAllergens } from "./allergens";
import { OcrWord } from "@/lib/ocr";
import { Provenance } from "@/lib/schemas/product";

export * from "./sections";
export * from "./nutrition";
export * from "./allergens";

export interface ParsedLabelResult {
  rawText: string;
  sections: ExtractedSections;
  nutrition: ParsedNutrition;
  allergens: ParsedAllergens;
  detected_name: string | null;
  detected_brand: string | null;
}

/**
 * Top-level label parser coordinating sections, nutrition tables, and allergens.
 */
export function parseLabelOcr(fullText: string, words?: OcrWord[]): ParsedLabelResult {
  const sections = extractSections(fullText);
  const nutrition = parseNutritionText(sections.nutritionText, words);
  const allergens = parseAllergens(sections.allergenText);

  // Attempt to find brand / product name from first non-empty lines before ingredients/nutrition
  const rawLines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let detectedName: string | null = null;
  const detectedBrand: string | null = null;

  if (rawLines.length > 0) {
    const firstLine = rawLines[0];
    if (firstLine.length < 50 && !/^(nutrition|ingredients|contains|allergen|mfg)/i.test(firstLine)) {
      detectedName = firstLine;
    }
  }

  return {
    rawText: fullText,
    sections,
    nutrition,
    allergens,
    detected_name: detectedName,
    detected_brand: detectedBrand,
  };
}

/**
 * Compares current value against original OCR parsed value to determine field provenance.
 * - Missing/empty -> "missing"
 * - Edited -> "user_corrected"
 * - Unedited -> "ocr"
 */
export function determineProvenance<T>(
  originalVal: T | null | undefined,
  currentVal: T | null | undefined
): Provenance {
  if (currentVal === null || currentVal === undefined || currentVal === "") {
    return "missing";
  }

  if (originalVal === null || originalVal === undefined || originalVal === "") {
    // Was missing originally, but now user filled it in
    return "user_corrected";
  }

  if (typeof originalVal === "number" && typeof currentVal === "number") {
    return Math.abs(originalVal - currentVal) < 0.0001 ? "ocr" : "user_corrected";
  }

  if (Array.isArray(originalVal) && Array.isArray(currentVal)) {
    if (originalVal.length !== currentVal.length) return "user_corrected";
    const matches = originalVal.every((v, i) => v === currentVal[i]);
    return matches ? "ocr" : "user_corrected";
  }

  return String(originalVal).trim() === String(currentVal).trim()
    ? "ocr"
    : "user_corrected";
}
