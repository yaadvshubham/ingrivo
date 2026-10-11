import { z } from "zod";

export const NutritionAvailabilitySchema = z.enum(["none", "partial", "most"]);
export type NutritionAvailability = z.infer<typeof NutritionAvailabilitySchema>;

export const ProductSummarySchema = z.object({
  ref: z.string(),
  name: z.string().nullable(),
  brand: z.string().nullable(),
  image_url: z.string().nullable(),
  categories: z.array(z.string()),
  has_ingredients: z.boolean(),
  nutrition_availability: NutritionAvailabilitySchema,
  source: z.string(),
});
export type ProductSummary = z.infer<typeof ProductSummarySchema>;

export const SearchResponseSchema = z.object({
  query: z.string(),
  page: z.number(),
  page_size: z.number(),
  total: z.number().nullable().optional(),
  page_count: z.number(),
  results: z.array(ProductSummarySchema),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
