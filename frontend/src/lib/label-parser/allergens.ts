export interface ParsedAllergens {
  declared: string[];
  traces: string[];
  declaredText: string;
  tracesText: string;
}

/**
 * Splits comma/semicolon/and delimited allergen strings into clean components.
 */
function cleanAllergenList(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  // Replace ' and ' with comma
  const normalized = text
    .replace(/\band\b/gi, ",")
    .replace(/[.;]$/, "");

  return normalized
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1 && !/^(and|may contain|contains|traces of)$/i.test(item));
}

/**
 * Parses allergen lines into declared allergens and potential traces.
 */
export function parseAllergens(text: string | null): ParsedAllergens {
  if (!text || text.trim().length === 0) {
    return {
      declared: [],
      traces: [],
      declaredText: "",
      tracesText: "",
    };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let declaredRaw = "";
  let tracesRaw = "";

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Check for 'may contain' or 'traces'
    const tracesIdx = lower.indexOf("may contain");
    const tracesAltIdx = lower.indexOf("traces of");

    if (tracesIdx !== -1 || tracesAltIdx !== -1) {
      const splitIdx = tracesIdx !== -1 ? tracesIdx : tracesAltIdx;

      // Check if there is a 'contains' before the traces
      const beforePart = line.slice(0, splitIdx).trim();
      const afterPart = line.slice(splitIdx).trim();

      if (beforePart.length > 0) {
        declaredRaw += (declaredRaw ? ", " : "") + beforePart;
      }
      tracesRaw += (tracesRaw ? ", " : "") + afterPart;
    } else {
      declaredRaw += (declaredRaw ? " " : "") + line;
    }
  }

  // Strip prefixes from declared text
  const cleanDeclaredText = declaredRaw
    .replace(/^(allergen information|allergy advice|contains)[\s:-]*/i, "")
    .trim();

  // Strip prefixes from traces text
  const cleanTracesText = tracesRaw
    .replace(/^(may contain traces of|may contain|traces of)[\s:-]*/i, "")
    .trim();

  const declared = cleanAllergenList(cleanDeclaredText);
  const traces = cleanAllergenList(cleanTracesText);

  return {
    declared,
    traces,
    declaredText: cleanDeclaredText,
    tracesText: cleanTracesText,
  };
}
