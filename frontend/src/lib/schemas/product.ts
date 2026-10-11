import { z } from "zod";

export const ProvenanceSchema = z.enum([
  "source",
  "ocr",
  "user_corrected",
  "derived",
  "missing",
]);
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const NutritionBasisSchema = z.enum([
  "per_100g",
  "per_100ml",
  "per_serving",
  "unknown",
]);
export type NutritionBasis = z.infer<typeof NutritionBasisSchema>;

export const IngredientsDataSchema = z.object({
  raw_text: z.string().nullable(),
  items: z.array(z.string()),
  language: z.string().nullable(),
  provenance: ProvenanceSchema,
});
export type IngredientsData = z.infer<typeof IngredientsDataSchema>;

export const NutrientValuesSchema = z.object({
  energy_kcal: z.number().nullable(),
  energy_kj: z.number().nullable(),
  sugars: z.number().nullable(),
  added_sugars: z.number().nullable().optional(), // Phase 6 extension: separate added sugars
  protein: z.number().nullable(),
  fat: z.number().nullable(),
  saturated_fat: z.number().nullable(),
  carbohydrates: z.number().nullable(),
  fibre: z.number().nullable(),
  sodium: z.number().nullable(),
  salt: z.number().nullable(),
});
export type NutrientValues = z.infer<typeof NutrientValuesSchema>;

export const NutritionDataSchema = z.object({
  basis: NutritionBasisSchema,
  serving_size: z.string().nullable(),
  values: NutrientValuesSchema,
  provenance: ProvenanceSchema,
});
export type NutritionData = z.infer<typeof NutritionDataSchema>;

export const AllergensDataSchema = z.object({
  declared: z.array(z.string()),
  traces: z.array(z.string()),
  provenance: ProvenanceSchema,
});
export type AllergensData = z.infer<typeof AllergensDataSchema>;

export const SourceDataSchema = z.object({
  name: z.string(),
  api_version: z.string().optional().nullable(),
  product_url: z.string().nullable().optional(),
  last_modified: z.string().nullable().optional(),
  retrieved_at: z.string(),
  license: z.string(),
});
export type SourceData = z.infer<typeof SourceDataSchema>;

export const CompletenessDataSchema = z.object({
  score: z.number(),
  missing: z.array(z.string()),
});
export type CompletenessData = z.infer<typeof CompletenessDataSchema>;

export const SourceComputedDataSchema = z.object({
  nutriscore: z.string().nullable(),
  nova_group: z.number().nullable(),
  additive_tags: z.array(z.string()),
});
export type SourceComputedData = z.infer<typeof SourceComputedDataSchema>;

export const ProductSchema = z.object({
  ref: z.string(),
  kind: z.string(),
  name: z.string().nullable(),
  name_provenance: ProvenanceSchema,
  brand: z.string().nullable(),
  brand_provenance: ProvenanceSchema,
  quantity: z.string().nullable(),
  quantity_provenance: ProvenanceSchema,
  image_url: z.string().nullable(),
  image_provenance: ProvenanceSchema,
  categories: z.array(z.string()),
  categories_provenance: ProvenanceSchema,

  ingredients: IngredientsDataSchema,
  nutrition: NutritionDataSchema,
  allergens: AllergensDataSchema,

  source: SourceDataSchema.nullable().optional(),
  completeness: CompletenessDataSchema,
  source_computed: SourceComputedDataSchema.optional(),
});
export type Product = z.infer<typeof ProductSchema>;
