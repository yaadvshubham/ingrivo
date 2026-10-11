import { describe, it, expect } from "vitest";
import { tokens, getContrastRatio } from "@/lib/tokens";

describe("Design System WCAG Contrast Tests", () => {
  it("verifies body text (ink) on surface background meets normal text WCAG AA (>= 4.5:1)", () => {
    const ratio = getContrastRatio(tokens.colors.ink, tokens.colors.surface);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("verifies body text (ink) on card background meets normal text WCAG AA (>= 4.5:1)", () => {
    const ratio = getContrastRatio(tokens.colors.ink, tokens.colors.card);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("verifies muted text on card background meets normal text WCAG AA (>= 4.5:1)", () => {
    const ratio = getContrastRatio(tokens.colors.muted, tokens.colors.card);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("verifies muted text on surface background meets normal text WCAG AA (>= 4.5:1)", () => {
    const ratio = getContrastRatio(tokens.colors.muted, tokens.colors.surface);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("verifies white text on forest primary background meets normal text WCAG AA (>= 4.5:1)", () => {
    const ratio = getContrastRatio("#FFFFFF", tokens.colors.forest);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("verifies white text on leaf secondary background meets large text / UI component WCAG AA (>= 3:1)", () => {
    const ratio = getContrastRatio("#FFFFFF", tokens.colors.leaf);
    expect(ratio).toBeGreaterThanOrEqual(3.0);
  });

  it("verifies ink text on saffron accent background meets large text / UI component WCAG AA (>= 3:1)", () => {
    const ratio = getContrastRatio(tokens.colors.ink, tokens.colors.saffron);
    expect(ratio).toBeGreaterThanOrEqual(3.0);
  });
});
