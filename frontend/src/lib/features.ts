export interface FeatureFlags {
  scan: boolean;
  search: boolean;
  label: boolean;
  compare: boolean;
  history: boolean;
  ai: boolean;
}

/**
 * Feature flags for Ingrivo.
 *
 * Activation roadmap:
 * - Phase 2: All flags false (scaffolding app shell, homepage preview, sample insights)
 * - Phase 3: scan enabled (Manual barcode lookup + OFF API integration); search in development
 * - Phase 4: label (Browser OCR, nutrition & ingredient label parsing)
 * - Phase 5: compare, history (Side-by-side nutrition comparison, local history)
 * - Phase 7: ai enabled (Structured AI product explanations)
 */
export const FEATURES: FeatureFlags = {
  scan: true, // Enabled in Phase 3 for manual barcode lookup
  search: true, // Enabled in Phase 5 for OFF search integration
  label: true, // Enabled in Phase 6 for on-device label OCR and review
  compare: true, // Enabled in Phase 8 for Product Comparison
  history: true, // Enabled in Phase 9 for Local History
  ai: true, // Enabled in Phase 7 for Gemini educational explanations
};

/**
 * Typed helper to check if a specific feature flag is currently enabled.
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return Boolean(FEATURES[feature]);
}
