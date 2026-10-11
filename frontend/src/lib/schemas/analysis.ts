import { z } from "zod";

export const IngredientNoteSchema = z.object({
  name: z.string(),
  explanation: z.string(),
  basis: z.enum(["product_evidence", "general_knowledge"]),
});

export type IngredientNote = z.infer<typeof IngredientNoteSchema>;

export const ObservationSchema = z.object({
  text: z.string(),
  evidence_refs: z.array(z.string()).default([]),
});

export type Observation = z.infer<typeof ObservationSchema>;

export const AllergenStatementSchema = z.object({
  declared: z.array(z.string()).default([]),
  note: z.string().default(""),
});

export type AllergenStatement = z.infer<typeof AllergenStatementSchema>;

export const ValidationMetaSchema = z.object({
  passed: z.boolean(),
  retried: z.boolean().default(false),
});

export type ValidationMeta = z.infer<typeof ValidationMetaSchema>;

export const ExplainResponseSchema = z.object({
  ai_status: z.enum(["available", "unavailable", "not_configured"]),
  model: z.string(),
  prompt_version: z.string(),
  generated_at: z.string(),
  summary: z.string(),
  ingredient_notes: z.array(IngredientNoteSchema).default([]),
  observations: z.array(ObservationSchema).default([]),
  allergen_statement: AllergenStatementSchema,
  missing_info: z.array(z.string()).default([]),
  caveats: z.array(z.string()).default([]),
  validation: ValidationMetaSchema,
});

export type ExplainResponse = z.infer<typeof ExplainResponseSchema>;

export type ExplainRequestSource =
  | { type: "barcode"; barcode: string }
  | { type: "label"; evidence: unknown };
