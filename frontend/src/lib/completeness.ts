import { CompletenessData } from "@/lib/schemas/product";

export interface CompletenessInput {
  name?: string | null;
  brand?: string | null;
  ingredients_text?: string | null;
  energy_kcal?: number | null;
  energy_kj?: number | null;
  sugars?: number | null;
  protein?: number | null;
  fat?: number | null;
  saturated_fat?: number | null;
  carbohydrates?: number | null;
  fibre?: number | null;
  sodium?: number | null;
  salt?: number | null;
  basis?: string | null;
}

/**
 * Computes product data completeness matching the backend normalizer formula exactly.
 * Evaluates the 12 key fields:
 * 1. name
 * 2. brand
 * 3. ingredients_text
 * 4. energy (energy_kcal or energy_kj)
 * 5. sugars
 * 6. protein
 * 7. fat
 * 8. saturated_fat
 * 9. carbohydrates
 * 10. fibre
 * 11. sodium_or_salt (sodium or salt)
 * 12. nutrition_basis (known basis)
 */
export function calculateCompleteness(input: CompletenessInput): CompletenessData {
  const namePresent = Boolean(input.name && input.name.trim().length > 0);
  const brandPresent = Boolean(input.brand && input.brand.trim().length > 0);
  const ingTextPresent = Boolean(input.ingredients_text && input.ingredients_text.trim().length > 0);

  const energyPresent = input.energy_kcal !== null && input.energy_kcal !== undefined ||
    input.energy_kj !== null && input.energy_kj !== undefined;

  const sugarsPresent = input.sugars !== null && input.sugars !== undefined;
  const proteinPresent = input.protein !== null && input.protein !== undefined;
  const fatPresent = input.fat !== null && input.fat !== undefined;
  const satFatPresent = input.saturated_fat !== null && input.saturated_fat !== undefined;
  const carbsPresent = input.carbohydrates !== null && input.carbohydrates !== undefined;
  const fibrePresent = input.fibre !== null && input.fibre !== undefined;

  const sodiumOrSaltPresent = (input.sodium !== null && input.sodium !== undefined) ||
    (input.salt !== null && input.salt !== undefined);

  const basisPresent = Boolean(input.basis && input.basis !== "unknown");

  const keyFields = [
    namePresent,
    brandPresent,
    ingTextPresent,
    energyPresent,
    sugarsPresent,
    proteinPresent,
    fatPresent,
    satFatPresent,
    carbsPresent,
    fibrePresent,
    sodiumOrSaltPresent,
    basisPresent,
  ];

  const missing: string[] = [];
  if (!namePresent) missing.push("name");
  if (!brandPresent) missing.push("brand");
  if (!ingTextPresent) missing.push("ingredients_text");
  if (!energyPresent) missing.push("energy");
  if (!sugarsPresent) missing.push("sugars");
  if (!proteinPresent) missing.push("protein");
  if (!fatPresent) missing.push("fat");
  if (!satFatPresent) missing.push("saturated_fat");
  if (!carbsPresent) missing.push("carbohydrates");
  if (!fibrePresent) missing.push("fibre");
  if (!sodiumOrSaltPresent) missing.push("sodium_or_salt");
  if (!basisPresent) missing.push("nutrition_basis");

  const presentCount = keyFields.filter(Boolean).length;
  const score = Math.round((presentCount / keyFields.length) * 100) / 100;

  return {
    score,
    missing,
  };
}
