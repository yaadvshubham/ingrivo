import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { calculateCompleteness } from "@/lib/completeness";

interface CompletenessCase {
  description: string;
  input: {
    name: string | null;
    brand: string | null;
    ingredients_text: string | null;
    energy_kcal: number | null;
    energy_kj: number | null;
    sugars: number | null;
    protein: number | null;
    fat: number | null;
    saturated_fat: number | null;
    carbohydrates: number | null;
    fibre: number | null;
    sodium: number | null;
    salt: number | null;
    basis: string | null;
  };
  expected: {
    score: number;
    missing: string[];
  };
}

describe("Shared Completeness Fixtures Test", () => {
  const fixturePath = path.resolve(
    __dirname,
    "../../../docs/shared-fixtures/completeness-cases.json"
  );
  const raw = fs.readFileSync(fixturePath, "utf-8");
  const testCases: CompletenessCase[] = JSON.parse(raw);

  testCases.forEach((tc) => {
    it(`should calculate completeness correctly for: ${tc.description}`, () => {
      const result = calculateCompleteness(tc.input);
      expect(result.score).toBe(tc.expected.score);
      expect(result.missing.sort()).toEqual(tc.expected.missing.sort());
    });
  });
});
