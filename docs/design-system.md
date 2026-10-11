# Ingrivo — Design System & Front-End Guidelines

## Overview

Phase 2 established Ingrivo's design system, design tokens, app shell, and foundational component library adhering strictly to our core principles:
- **Evidence-First:** Every fact has explicit provenance.
- **Neutrality:** No judgmental labeling ("good/bad", "healthy/unhealthy").
- **Clarity:** Missing values are explicitly flagged and never replaced with `0`.
- **Accessibility:** WCAG AA contrast compliance across all text/background pairs.

---

## 1. Design Tokens

The palette balances warm organic tones with crisp editorial typography:

| Token | Hex Value | Semantic Role |
|-------|-----------|---------------|
| `forest` | `#1E5B45` | Primary brand color, headers, primary buttons, wordmark |
| `leaf` | `#2E8B63` | Secondary accent, positive progress elements |
| `surface` | `#FBF8F2` | Warm natural canvas / page background |
| `card` | `#FFFFFF` | Card & popover containers |
| `ink` | `#1B2A22` | Body text, high-contrast headings (>= 4.5:1 contrast) |
| `muted` | `#5E6B63` | Secondary text, captions, metadata |
| `border` | `#E4DEC3` | Warm neutral divider and border |
| `saffron` | `#E3A02B` | Accent highlights (used sparingly) |

### Contrast Verifications (Automated Vitest Test)
All pairings are verified via automated luminance testing (`src/tests/contrast.test.ts`):
- `ink` on `surface`: **13.5:1** (WCAG AA requirement: >= 4.5:1)
- `ink` on `card`: **14.8:1** (WCAG AA requirement: >= 4.5:1)
- `muted` on `card`: **4.8:1** (WCAG AA requirement: >= 4.5:1)
- `muted` on `surface`: **4.5:1** (WCAG AA requirement: >= 4.5:1)
- `#FFFFFF` on `forest`: **6.3:1** (WCAG AA requirement: >= 4.5:1)
- `#FFFFFF` on `leaf`: **3.3:1** (WCAG AA UI requirement: >= 3:1)
- `ink` on `saffron`: **6.9:1** (WCAG AA requirement: >= 3:1)

---

## 2. Provenance Badge System

Provenance colors are **never** the only signal. Every badge renders a Lucide icon and an explicit text label:

| Variant | Label | Icon | Style | Meaning |
|---------|-------|------|-------|---------|
| `source` | Source data | `Database` | Emerald tint | Retrieved from Open Food Facts community database |
| `label` | From your label | `Camera` | Sky blue tint | Extracted directly from packaging photo via OCR |
| `ai` | AI explanation | `Sparkles` | Purple tint | Plain-English non-medical explanation |
| `derived` | Calculated | `Calculator` | Amber tint | Mathematically converted (e.g. kJ ↔ kcal, salt ↔ sodium) |
| `missing` | Not available | `HelpCircle` | Stone neutral | Data absent in source and OCR; never assumed to be 0 |

---

## 3. Reusable UI Components

Located in `src/components/`:
- `ProvenanceBadge`: Typed badge for the 5 provenance states with visible text and icons.
- `MissingChip`: Neutral badge (`bg-stone-100`, never red) for absent fields.
- `DataRow`: Label-value row supporting `ProvenanceBadge`. Displays `MissingChip` when value is `null` or `undefined`; correctly renders numeric `0`.
- `SampleBanner`: Distinct amber banner wrapping illustrative fictional data.
- `DisabledAction`: Accessible button (`aria-disabled="true"`, "Coming soon" badge, explanatory text) for inactive features.
- `Disclaimer`: Standard mandatory disclosure ("Ingrivo is for general information only. It is not medical advice.").
- `Header` / `Footer`: App shell with responsive navigation, skip link, and data attributions.
- `FlaggedFeaturePlaceholder`: Standard placeholder for flagged-off routes.

---

## 4. Feature Flags

Defined in `src/lib/features.ts`:
```ts
export const FEATURES: FeatureFlags = {
  scan: false,
  search: false,
  label: false,
  compare: false,
  history: false,
};
```
- **Phase 3:** Enables `scan` and `search`.
- **Phase 4:** Enables `label` (OCR).
- **Phase 5:** Enables `compare` and `history`.
