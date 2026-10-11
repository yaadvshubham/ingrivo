export interface FeatureFlags {
  scan: boolean;
  search: boolean;
  label: boolean;
  compare: boolean;
  history: boolean;
}

/**
 * Feature flags for Ingrivo.
 *
 * Activation roadmap:
 * - Phase 2: All flags false (scaffolding app shell, homepage preview, sample insights)
 * - Phase 3: scan enabled (Manual barcode lookup + OFF API integration); search in development
 * - Phase 4: label (Browser OCR, nutrition & ingredient label parsing)
 * - Phase 5: compare, history (Side-by-side nutrition comparison, local history)
 */
export const FEATURES: FeatureFlags = {
  scan: true, // Enabled in Phase 3 for manual barcode lookup
  search: true, // Enabled in Phase 5 for OFF search integration
  label: false,
  compare: false,
  history: false,
};

/**
 * Typed helper to check if a specific feature flag is currently enabled.
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return Boolean(FEATURES[feature]);
}
