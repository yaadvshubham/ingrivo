/**
 * Canonical Design System Tokens for Ingrivo
 *
 * Primary: Forest (#1E5B45)
 * Secondary / Natural leaf: Leaf (#2E8B63)
 * Background / Surface: Warm natural cream (#FBF8F2)
 * Card Background: Pure white (#FFFFFF)
 * Body Text / Ink: Deep dark slate forest (#1B2A22)
 * Muted Text: Warm grey (#5E6B63)
 * Border: Warm neutral border (#E4DEC3)
 * Accent: Saffron (#E3A02B)
 */
export const tokens = {
  colors: {
    forest: "#1E5B45",
    leaf: "#2E8B63",
    surface: "#FBF8F2",
    card: "#FFFFFF",
    ink: "#1B2A22",
    muted: "#5E6B63",
    border: "#E4DEC3",
    saffron: "#E3A02B",
  },
} as const;

/**
 * Calculates the relative luminance of a hexadecimal RGB color string.
 * WCAG 2.1 formula.
 */
export function getLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calculates WCAG contrast ratio between two hex colors.
 * Contrast ratio is (L1 + 0.05) / (L2 + 0.05), where L1 is the lighter color.
 */
export function getContrastRatio(colorA: string, colorB: string): number {
  const lumA = getLuminance(colorA);
  const lumB = getLuminance(colorB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}
