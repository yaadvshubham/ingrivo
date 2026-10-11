/**
 * Levenshtein distance calculation for fuzzy heading matching.
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, () => new Array<number>(an + 1).fill(0));

  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1, // deletion
        matrix[j][i - 1] + 1, // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }

  return matrix[bn][an];
}

/**
 * Normalizes text for heading matching: converts common OCR letter confusions
 * ('l' -> 'i', '1' -> 'i', '0' -> 'o', '5' -> 's') and strips punctuation.
 */
function normalizeForHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[1l|]/g, "i")
    .replace(/0/g, "o")
    .replace(/5/g, "s")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INGREDIENTS_KEYWORDS = [
  "ingredients",
  "ingredient list",
  "composition",
  "contents",
];

const NUTRITION_KEYWORDS = [
  "nutrition information",
  "nutritional information",
  "nutrition facts",
  "nutritional facts",
  "nutrition values",
  "nutritional values",
  "nutrition per",
  "nutritional per",
  "typical values",
  "nutrition panel",
  "nutritive values",
  "nutrition",
  "nutritional",
];

const ALLERGEN_KEYWORDS = [
  "allergen information",
  "allergy advice",
  "allergen advice",
  "contains",
  "may contain",
  "allergens",
];

const NEIGHBOR_KEYWORDS = [
  "manufactured by",
  "marketed by",
  "mfg by",
  "mfd by",
  "packed by",
  "fssai",
  "lic no",
  "license no",
  "best before",
  "expiry date",
  "exp date",
  "batch no",
  "lot no",
  "net weight",
  "net quantity",
  "storage condition",
  "store in a cool",
  "customer care",
  "for feedback",
  "country of origin",
];

export type SectionType = "ingredients" | "nutrition" | "allergen" | "neighbor";

export interface MatchedSectionHeading {
  type: SectionType;
  lineIndex: number;
  matchedText: string;
}

export interface ExtractedSections {
  rawText: string;
  ingredientsText: string | null;
  allergenText: string | null;
  nutritionText: string | null;
}

function matchLineToKeywords(line: string, keywords: string[]): boolean {
  const norm = normalizeForHeading(line);
  if (!norm) return false;

  for (const kw of keywords) {
    const normKw = normalizeForHeading(kw);
    // Direct inclusion
    if (norm.includes(normKw)) return true;
    // Fuzzy match on words or prefix
    const words = norm.split(" ");
    const kwWords = normKw.split(" ");
    if (kwWords.length === 1 && words.length > 0) {
      for (const w of words.slice(0, 3)) {
        if (Math.abs(w.length - normKw.length) <= 2) {
          if (levenshteinDistance(w, normKw) <= 2) {
            return true;
          }
        }
      }
    } else if (kwWords.length > 1) {
      // Check first 2-3 words joined
      const joinedPrefix = words.slice(0, kwWords.length).join(" ");
      if (Math.abs(joinedPrefix.length - normKw.length) <= 3) {
        if (levenshteinDistance(joinedPrefix, normKw) <= 2) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Splits raw OCR text into Ingredients, Nutrition, Allergens, and Neighbors.
 */
export function extractSections(rawText: string): ExtractedSections {
  const rawLines = rawText.split(/\r?\n/).map((l) => l.trim());
  const headings: MatchedSectionHeading[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line) continue;

    if (matchLineToKeywords(line, NUTRITION_KEYWORDS)) {
      headings.push({ type: "nutrition", lineIndex: i, matchedText: line });
    } else if (matchLineToKeywords(line, INGREDIENTS_KEYWORDS)) {
      headings.push({ type: "ingredients", lineIndex: i, matchedText: line });
    } else if (matchLineToKeywords(line, ALLERGEN_KEYWORDS)) {
      headings.push({ type: "allergen", lineIndex: i, matchedText: line });
    } else if (matchLineToKeywords(line, NEIGHBOR_KEYWORDS)) {
      headings.push({ type: "neighbor", lineIndex: i, matchedText: line });
    }
  }

  // Slice lines between headings
  let ingredientsLines: string[] = [];
  const allergenLines: string[] = [];
  const nutritionLines: string[] = [];

  for (let i = 0; i < headings.length; i++) {
    const cur = headings[i];
    const nextIdx = i + 1 < headings.length ? headings[i + 1].lineIndex : rawLines.length;

    const blockLines = rawLines.slice(cur.lineIndex, nextIdx);

    if (cur.type === "ingredients") {
      ingredientsLines.push(...blockLines);
    } else if (cur.type === "allergen") {
      allergenLines.push(...blockLines);
    } else if (cur.type === "nutrition") {
      nutritionLines.push(...blockLines);
    }
  }

  // Handle case where inline contains/allergen appears inside ingredients block
  if (ingredientsLines.length > 0 && allergenLines.length === 0) {
    const remainingIng: string[] = [];
    for (const l of ingredientsLines) {
      const lower = l.toLowerCase();
      if (lower.includes("contains:") || lower.includes("contains ") || lower.includes("may contain")) {
        allergenLines.push(l);
      } else {
        remainingIng.push(l);
      }
    }
    ingredientsLines = remainingIng;
  }

  // Clean heading text from ingredients and allergens if present as first line
  const cleanSectionText = (lines: string[], kwList: string[]): string | null => {
    if (lines.length === 0) return null;
    let text = lines.join(" \n").trim();
    for (const kw of kwList) {
      const reg = new RegExp(`^\\s*${kw}[:\\s-]*`, "i");
      text = text.replace(reg, "").trim();
    }
    return text.length > 0 ? text : null;
  };

  const ingredientsText = cleanSectionText(ingredientsLines, INGREDIENTS_KEYWORDS);
  const allergenText = cleanSectionText(allergenLines, ALLERGEN_KEYWORDS);
  const nutritionText = nutritionLines.length > 0 ? nutritionLines.join("\n").trim() : null;

  return {
    rawText,
    ingredientsText,
    allergenText,
    nutritionText,
  };
}
