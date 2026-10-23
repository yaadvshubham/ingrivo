import { z } from "zod";

export const CompareProductSummarySchema = z.object({
  ref: z.string(),
  name: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  basis: z.string(),
  serving_size: z.string().nullable().optional(),
  completeness: z.object({
    score: z.number(),
    missing: z.array(z.string()).default([]),
  }),
});

export type CompareProductSummary = z.infer<typeof CompareProductSummarySchema>;

export const CompareNutrientRowSchema = z.object({
  nutrient: z.string(),
  label: z.string(),
  unit: z.string(),
  val_a: z.number().nullable().optional(),
  provenance_a: z.string().default("missing"),
  derivation_a: z.string().nullable().optional(),
  basis_a: z.string(),
  val_b: z.number().nullable().optional(),
  provenance_b: z.string().default("missing"),
  derivation_b: z.string().nullable().optional(),
  basis_b: z.string(),
  comparable: z.boolean(),
  incomparable_reason: z.string().nullable().optional(),
  diff_absolute: z.number().nullable().optional(),
  diff_relative_percent: z.number().nullable().optional(),
  direction: z.enum(["a_higher", "b_higher", "same", "incomparable"]),
  notable: z.boolean().default(false),
  notable_reason: z.string().nullable().optional(),
});

export type CompareNutrientRow = z.infer<typeof CompareNutrientRowSchema>;

export const IngredientDiffSchema = z.object({
  shared: z.array(z.string()).default([]),
  only_a: z.array(z.string()).default([]),
  only_b: z.array(z.string()).default([]),
  is_approximate: z.boolean().default(true),
  disclaimer: z.string().default("Ingredients parsed and matched approximately. Synonyms and formulations may vary."),
});

export type IngredientDiff = z.infer<typeof IngredientDiffSchema>;

export const AllergenDiffSchema = z.object({
  shared: z.array(z.string()).default([]),
  only_a: z.array(z.string()).default([]),
  only_b: z.array(z.string()).default([]),
  note_a: z.string(),
  note_b: z.string(),
});

export type AllergenDiff = z.infer<typeof AllergenDiffSchema>;

export const CompareAiDifferenceSchema = z.object({
  text: z.string(),
  evidence_refs: z.array(z.string()).default([]),
});

export type CompareAiDifference = z.infer<typeof CompareAiDifferenceSchema>;

export const CompareAiResponseSchema = z.object({
  summary: z.string(),
  differences: z.array(CompareAiDifferenceSchema).default([]),
  limitations: z.array(z.string()).default([]),
  model: z.string(),
  generated_at: z.string(),
  validation_passed: z.boolean().default(true),
});

export type CompareAiResponse = z.infer<typeof CompareAiResponseSchema>;

export const CompareResponseSchema = z.object({
  a: CompareProductSummarySchema,
  b: CompareProductSummarySchema,
  nutrient_rows: z.array(CompareNutrientRowSchema),
  ingredients_diff: IngredientDiffSchema,
  allergens_diff: AllergenDiffSchema,
  ai: CompareAiResponseSchema.nullable().optional(),
  ai_status: z.enum(["available", "unavailable", "failed", "not_configured", "omitted"]),
});

export type CompareResponse = z.infer<typeof CompareResponseSchema>;

export type CompareRequestSource =
  | { type: "barcode"; barcode: string }
  | { type: "label"; evidence: unknown };

export interface CompareRequest {
  a: CompareRequestSource;
  b: CompareRequestSource;
  include_ai_explanation?: boolean;
  language?: "en";
}
