import { NutritionBasis } from "@/lib/schemas/product";
import { OcrWord } from "@/lib/ocr";

export interface ParsedNutrientRow {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  ocr_suspect: boolean;
  low_confidence: boolean;
  raw_token?: string;
}

export interface UnmappedNutrientRow {
  name: string;
  valueStr: string;
  unitStr: string;
  rawText: string;
  ocr_suspect: boolean;
}

export interface ColumnData {
  basis: NutritionBasis;
  serving_size: string | null;
  label: string;
  values: {
    energy_kcal: number | null;
    energy_kj: number | null;
    sugars: number | null;
    added_sugars: number | null;
    protein: number | null;
    fat: number | null;
    saturated_fat: number | null;
    carbohydrates: number | null;
    fibre: number | null;
    sodium: number | null;
    salt: number | null;
  };
  rows: ParsedNutrientRow[];
  suspect_fields: string[];
}

export interface ParsedNutrition {
  detected_basis: NutritionBasis;
  serving_size: string | null;
  needs_column_choice: boolean;
  columns: ColumnData[];
  unmapped_rows: UnmappedNutrientRow[];
  warnings: string[];
  all_numeric_tokens: string[];
}

/**
 * Checks whether a token has common OCR digit confusion:
 * e.g. letters 'O', 'l', 'I', 'S', 'B' mixed with digits or decimal points.
 */
export function isOcrSuspect(token: string): boolean {
  // Contains letters O, l, I, S, B right next to digits or decimals (e.g. "1O.5", "l2", "5.S", "B.2")
  // but exclude standard unit suffixes like g, mg, kcal, kj
  const strippedUnit = token.replace(/(g|mg|mcg|µg|kcal|kj|ml)$/i, "").trim();
  if (!strippedUnit) return false;

  const hasDigitsOrDecimals = /[\d.,]/.test(strippedUnit);
  if (!hasDigitsOrDecimals) return false;

  // Check for suspect letters
  const hasSuspectLetters = /[OlISB]/.test(strippedUnit);
  if (hasSuspectLetters) {
    // If it looks like a word, e.g. "FAT", ignore, but if mixed like "1O" or "l2.5" or "5.S", it's suspect
    if (/(\d[OlISB]|[OlISB]\d|\.[OlISB]|[OlISB]\.)/.test(strippedUnit)) {
      return true;
    }
    if (/^[OlISB]+[.,]\d+$/.test(strippedUnit) || /^\d+[.,][OlISB]+$/.test(strippedUnit)) {
      return true;
    }
  }

  return false;
}

/**
 * Parses numeric value from token, handling comma decimals ("12,5" -> 12.5).
 * Does NOT auto-correct OCR suspect letters into numbers.
 */
export function parseNumericToken(token: string): number | null {
  // Strip trailing unit like g, mg, kcal, kj, ml
  let clean = token.replace(/([a-zA-Z%]+)$/, "").trim();
  // Comma decimal
  clean = clean.replace(",", ".");

  if (!clean || !/^-?\d+(\.\d+)?$/.test(clean)) {
    return null;
  }

  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

interface ExtractedToken {
  text: string;
  value: number | null;
  isPercent: boolean;
  isSuspect: boolean;
  unit?: string;
  lowConfidence: boolean;
}

/**
 * Tokenizes a line into numeric/value tokens, explicitly ignoring % tokens.
 */
function extractValueTokens(line: string, wordConfidenceMap?: Map<string, number>): ExtractedToken[] {
  const tokens: ExtractedToken[] = [];

  // Match sequences that resemble numbers or units
  // Regex matches words, numbers, punctuation
  const rawParts = line.split(/\s+/);

  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i].replace(/[():;]/g, "").trim();
    if (!part) continue;

    // Check if followed by % or ends with % (e.g. "15%" or "15" followed by "%")
    const hasInlinePercent = part.endsWith("%");
    const nextIsPercent = i + 1 < rawParts.length && rawParts[i + 1].startsWith("%");

    if (hasInlinePercent || nextIsPercent) {
      // Numbers followed by "%" are NEVER nutrient values
      continue;
    }

    // Check for units
    const unitMatch = part.match(/(kcal|kj|mg|mcg|µg|g|ml)$/i);
    const unit = unitMatch ? unitMatch[1].toLowerCase() : undefined;

    const suspect = isOcrSuspect(part);
    const val = parseNumericToken(part);

    const conf = wordConfidenceMap ? wordConfidenceMap.get(part.toLowerCase()) : undefined;
    const isLowConf = conf !== undefined && conf < 60;

    if (val !== null || suspect) {
      tokens.push({
        text: part,
        value: val,
        isPercent: false,
        isSuspect: suspect,
        unit,
        lowConfidence: isLowConf,
      });
    }
  }

  return tokens;
}

/**
 * Checks sanity of parsed nutrition values and generates neutral warnings.
 */
export function runNutritionSanityChecks(
  values: ColumnData["values"],
  basis: NutritionBasis
): string[] {
  const warnings: string[] = [];

  // 1. Saturated fat > total fat
  if (
    values.saturated_fat !== null &&
    values.fat !== null &&
    values.saturated_fat > values.fat
  ) {
    warnings.push(
      `Saturated fat (${values.saturated_fat}g) is greater than total fat (${values.fat}g) — worth double-checking against the label.`
    );
  }

  // 2. Sugars > carbohydrates
  if (
    values.sugars !== null &&
    values.carbohydrates !== null &&
    values.sugars > values.carbohydrates
  ) {
    warnings.push(
      `Total sugars (${values.sugars}g) is greater than total carbohydrates (${values.carbohydrates}g) — worth double-checking against the label.`
    );
  }

  // 3. Macro per-100g values above 100
  if (basis === "per_100g" || basis === "per_100ml") {
    const macros = [
      { name: "Fat", val: values.fat },
      { name: "Saturated fat", val: values.saturated_fat },
      { name: "Carbohydrates", val: values.carbohydrates },
      { name: "Total sugars", val: values.sugars },
      { name: "Protein", val: values.protein },
      { name: "Fibre", val: values.fibre },
      { name: "Salt", val: values.salt },
    ];
    for (const m of macros) {
      if (m.val !== null && m.val > 100) {
        warnings.push(
          `${m.name} (${m.val}g) exceeds 100g per 100g/ml — worth double-checking against the label.`
        );
      }
    }
  }

  // 4. Energy far from macro implications
  // implied = 4 * carbs + 4 * protein + 9 * fat
  if (
    values.energy_kcal !== null &&
    values.energy_kcal > 10 &&
    values.carbohydrates !== null &&
    values.protein !== null &&
    values.fat !== null
  ) {
    const implied =
      4 * values.carbohydrates + 4 * values.protein + 9 * values.fat;
    const totalMacros = values.carbohydrates + values.protein + values.fat;

    if (totalMacros > 10) {
      const diff = Math.abs(values.energy_kcal - implied);
      const ratio = diff / values.energy_kcal;
      if (ratio > 0.35) {
        warnings.push(
          `Energy stated (${values.energy_kcal} kcal) is noticeably different from macro calculation (~${Math.round(implied)} kcal) — worth double-checking against the label.`
        );
      }
    }
  }

  return warnings;
}

/**
 * Extracts structured nutrition table from OCR text.
 */
export function parseNutritionText(
  nutritionText: string | null,
  ocrWords?: OcrWord[]
): ParsedNutrition {
  const emptyResult: ParsedNutrition = {
    detected_basis: "unknown",
    serving_size: null,
    needs_column_choice: false,
    columns: [],
    unmapped_rows: [],
    warnings: [],
    all_numeric_tokens: [],
  };

  if (!nutritionText || nutritionText.trim().length === 0) {
    return emptyResult;
  }

  // Build confidence map for words
  const confidenceMap = new Map<string, number>();
  if (ocrWords) {
    for (const w of ocrWords) {
      confidenceMap.set(w.text.toLowerCase(), w.confidence);
    }
  }

  const rawLines = nutritionText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1. Detect headers and columns
  let hasPer100g = false;
  let hasPer100ml = false;
  let hasPerServing = false;
  let detectedServingSize: string | null = null;

  for (const line of rawLines) {
    const lower = line.toLowerCase();
    if (lower.includes("per 100g") || lower.includes("per 100 g") || lower.includes("100g") || lower.includes("100 g")) {
      hasPer100g = true;
    }
    if (lower.includes("per 100ml") || lower.includes("per 100 ml") || lower.includes("100ml") || lower.includes("100 ml")) {
      hasPer100ml = true;
    }
    if (lower.includes("per serve") || lower.includes("per serving") || lower.includes("per portion")) {
      hasPerServing = true;
    }
    // Check serving size definition e.g. "serving size: 30g", "serving size: 2 pieces (40g)"
    const sMatch = line.match(/(serving size|per serving|serve size)[\s:-]+(.*)/i);
    if (sMatch) {
      const candidate = sMatch[2].trim();
      const weightMatch = candidate.match(/\(([\d.,]+\s*(?:g|ml))\)/i) || candidate.match(/([\d.,]+\s*(?:g|ml))/i);
      detectedServingSize = weightMatch ? weightMatch[1].replace(/\s+/g, "") : candidate;
      hasPerServing = true;
    }
  }

  // Nutrient matching patterns
  const NUTRIENT_DEFINITIONS: Array<{
    key: keyof ColumnData["values"];
    label: string;
    unit: string;
    patterns: RegExp[];
  }> = [
    {
      key: "energy_kcal",
      label: "Energy",
      unit: "kcal",
      patterns: [/energy/i, /calories/i, /kcal/i],
    },
    {
      key: "fat",
      label: "Total Fat",
      unit: "g",
      patterns: [/^total\s*fat/i, /^fat\b/i, /lipids/i],
    },
    {
      key: "saturated_fat",
      label: "Saturated Fat",
      unit: "g",
      patterns: [/saturated\s*(fat|fatty acids)/i, /saturates/i, /of which saturates/i],
    },
    {
      key: "carbohydrates",
      label: "Carbohydrates",
      unit: "g",
      patterns: [/total\s*carbohydrate/i, /carbohydrates?/i, /carbs/i],
    },
    {
      key: "added_sugars",
      label: "Added Sugars",
      unit: "g",
      patterns: [/added\s*sugars?/i, /of which added sugars?/i],
    },
    {
      key: "sugars",
      label: "Total Sugars",
      unit: "g",
      patterns: [/total\s*sugars?/i, /sugars?/i, /of which sugars/i],
    },
    {
      key: "protein",
      label: "Protein",
      unit: "g",
      patterns: [/proteins?/i],
    },
    {
      key: "fibre",
      label: "Dietary Fibre",
      unit: "g",
      patterns: [/dietary\s*fib(re|er)/i, /fib(re|er)/i],
    },
    {
      key: "salt",
      label: "Salt",
      unit: "g",
      patterns: [/^salt\b/i],
    },
    {
      key: "sodium",
      label: "Sodium",
      unit: "g",
      patterns: [/^sodium\b/i],
    },
  ];

  interface RawRowMatch {
    def?: typeof NUTRIENT_DEFINITIONS[0];
    isEnergyRow?: boolean;
    energyKjTokens?: ExtractedToken[];
    energyKcalTokens?: ExtractedToken[];
    line: string;
    tokens: ExtractedToken[];
  }

  const matchedRows: RawRowMatch[] = [];
  const unmappedRows: UnmappedNutrientRow[] = [];
  const allNumericTokens: string[] = [];

  for (const line of rawLines) {
    const tokens = extractValueTokens(line, confidenceMap);
    tokens.forEach((t) => allNumericTokens.push(t.text));

    // Check if line looks like header only
    if (
      /^(nutrition|nutritional|typical values|per 100|per serve|serving size|amount per)/i.test(
        line
      ) &&
      tokens.length === 0
    ) {
      continue;
    }

    // Special check for energy row which might have kJ and kcal
    const isEnergy = /energy|calories/i.test(line);
    if (isEnergy) {
      // Split or find both kJ and kcal
      const kjMatch = line.match(/([\d.,]+)\s*kj/i);
      const kcalMatch = line.match(/([\d.,]+)\s*kcal/i);

      matchedRows.push({
        isEnergyRow: true,
        line,
        tokens,
        energyKjTokens: kjMatch ? [{ text: kjMatch[1], value: parseNumericToken(kjMatch[1]), isPercent: false, isSuspect: isOcrSuspect(kjMatch[1]), unit: "kj", lowConfidence: false }] : undefined,
        energyKcalTokens: kcalMatch ? [{ text: kcalMatch[1], value: parseNumericToken(kcalMatch[1]), isPercent: false, isSuspect: isOcrSuspect(kcalMatch[1]), unit: "kcal", lowConfidence: false }] : undefined,
      });
      continue;
    }

    // Match against nutrients (check added sugars before total sugars!)
    let matchedDef: typeof NUTRIENT_DEFINITIONS[0] | undefined;
    for (const def of NUTRIENT_DEFINITIONS) {
      if (def.key === "energy_kcal") continue; // Handled above
      if (def.patterns.some((pat) => pat.test(line))) {
        matchedDef = def;
        break;
      }
    }

    if (matchedDef && tokens.length > 0) {
      matchedRows.push({
        def: matchedDef,
        line,
        tokens,
      });
    } else if (tokens.length > 0 && !/^(batch|mfg|fssai|net weight)/i.test(line)) {
      // Unmapped row with numbers
      const firstToken = tokens[0];
      const tokenIdx = line.indexOf(firstToken.text);
      const namePart = (tokenIdx > 0 ? line.slice(0, tokenIdx) : line)
        .replace(/[:=]/g, "")
        .trim();

      unmappedRows.push({
        name: namePart || line,
        valueStr: firstToken.text,
        unitStr: firstToken.unit || "",
        rawText: line,
        ocr_suspect: firstToken.isSuspect,
      });
    }
  }

  // Determine number of columns
  const maxTokens = Math.max(0, ...matchedRows.map((r) => r.tokens.length));
  const hasTwoColumns = maxTokens >= 2;

  // Determine column bases
  const col1Basis: NutritionBasis = hasPer100ml
    ? "per_100ml"
    : hasPer100g
    ? "per_100g"
    : hasPerServing && !hasTwoColumns
    ? "per_serving"
    : "unknown";

  const col2Basis: NutritionBasis = hasPerServing
    ? "per_serving"
    : col1Basis === "per_100g"
    ? "per_serving"
    : "unknown";

  function createEmptyValues(): ColumnData["values"] {
    return {
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
  }

  const col1Values = createEmptyValues();
  const col1Rows: ParsedNutrientRow[] = [];
  const col1Suspect: string[] = [];

  const col2Values = createEmptyValues();
  const col2Rows: ParsedNutrientRow[] = [];
  const col2Suspect: string[] = [];

  for (const mr of matchedRows) {
    if (mr.isEnergyRow) {
      // Handle energy
      if (mr.energyKcalTokens && mr.energyKcalTokens.length > 0) {
        col1Values.energy_kcal = mr.energyKcalTokens[0].value;
      }
      if (mr.energyKjTokens && mr.energyKjTokens.length > 0) {
        col1Values.energy_kj = mr.energyKjTokens[0].value;
      }
      if (col1Values.energy_kcal === null && mr.tokens.length > 0) {
        col1Values.energy_kcal = mr.tokens[0].value;
      }
      if (mr.tokens.length > 1) {
        col2Values.energy_kcal = mr.tokens[1].value;
      }
      col1Rows.push({
        key: "energy",
        label: "Energy",
        value: col1Values.energy_kcal,
        unit: "kcal",
        ocr_suspect: mr.tokens.some((t) => t.isSuspect),
        low_confidence: mr.tokens.some((t) => t.lowConfidence),
        raw_token: mr.tokens[0]?.text,
      });
      if (hasTwoColumns) {
        col2Rows.push({
          key: "energy",
          label: "Energy",
          value: col2Values.energy_kcal,
          unit: "kcal",
          ocr_suspect: mr.tokens.slice(1).some((t) => t.isSuspect),
          low_confidence: mr.tokens.slice(1).some((t) => t.lowConfidence),
          raw_token: mr.tokens[1]?.text,
        });
      }
      continue;
    }

    if (!mr.def) continue;

    const t1 = mr.tokens[0];
    if (t1) {
      col1Values[mr.def.key] = t1.value;
      if (t1.isSuspect || t1.lowConfidence) {
        col1Suspect.push(mr.def.label);
      }
      col1Rows.push({
        key: mr.def.key,
        label: mr.def.label,
        value: t1.value,
        unit: t1.unit || mr.def.unit,
        ocr_suspect: t1.isSuspect,
        low_confidence: t1.lowConfidence,
        raw_token: t1.text,
      });
    }

    if (hasTwoColumns && mr.tokens.length > 1) {
      const t2 = mr.tokens[1];
      col2Values[mr.def.key] = t2.value;
      if (t2.isSuspect || t2.lowConfidence) {
        col2Suspect.push(mr.def.label);
      }
      col2Rows.push({
        key: mr.def.key,
        label: mr.def.label,
        value: t2.value,
        unit: t2.unit || mr.def.unit,
        ocr_suspect: t2.isSuspect,
        low_confidence: t2.lowConfidence,
        raw_token: t2.text,
      });
    }
  }

  // Handle conversion of salt / sodium if one unit is mg (e.g. 500mg sodium = 0.5g)
  // But rule: "never infer a value that is not in the text". We only normalize mg to g if unit was mg!
  // Note: if sodium was given in mg, e.g. "500 mg", in nutrition values standard unit is g: 0.5g
  // We keep the exact value from tokens.

  const columns: ColumnData[] = [];

  const col1Label =
    col1Basis === "per_100ml"
      ? "Per 100 ml"
      : col1Basis === "per_100g"
      ? "Per 100 g"
      : col1Basis === "per_serving"
      ? `Per Serving (${detectedServingSize || "serving"})`
      : "Column 1";

  columns.push({
    basis: col1Basis,
    serving_size: detectedServingSize,
    label: col1Label,
    values: col1Values,
    rows: col1Rows,
    suspect_fields: col1Suspect,
  });

  if (hasTwoColumns) {
    const col2Label =
      col2Basis === "per_serving"
        ? `Per Serving (${detectedServingSize || "serving"})`
        : "Column 2";

    columns.push({
      basis: col2Basis,
      serving_size: detectedServingSize,
      label: col2Label,
      values: col2Values,
      rows: col2Rows,
      suspect_fields: col2Suspect,
    });
  }

  const warnings = runNutritionSanityChecks(col1Values, col1Basis);

  return {
    detected_basis: col1Basis,
    serving_size: detectedServingSize,
    needs_column_choice: hasTwoColumns,
    columns,
    unmapped_rows: unmappedRows,
    warnings,
    all_numeric_tokens: allNumericTokens,
  };
}
