import { describe, it, expect } from "vitest";
import { parseLabelOcr, isOcrSuspect, determineProvenance } from "@/lib/label-parser";

describe("Label Parser - 15 Synthetic Label Test Cases", () => {
  // Case 1: Clean per-100g label
  it("Case 1: Clean per-100g label", () => {
    const text = `
Crispy Multigrain Toast
Ingredients: Whole wheat flour, oat bran, flax seeds, sea salt.
Nutrition Facts (per 100g):
Energy: 395 kcal
Total Fat: 8.5 g
Saturated Fat: 1.2 g
Carbohydrates: 65.0 g
Total Sugars: 3.0 g
Dietary Fibre: 11.0 g
Protein: 14.5 g
Salt: 0.85 g
`;
    const res = parseLabelOcr(text);
    expect(res.nutrition.detected_basis).toBe("per_100g");
    expect(res.nutrition.columns[0].values.energy_kcal).toBe(395);
    expect(res.nutrition.columns[0].values.fat).toBe(8.5);
    expect(res.nutrition.columns[0].values.saturated_fat).toBe(1.2);
    expect(res.nutrition.columns[0].values.carbohydrates).toBe(65.0);
    expect(res.nutrition.columns[0].values.protein).toBe(14.5);
    expect(res.nutrition.columns[0].values.fibre).toBe(11.0);
    expect(res.nutrition.columns[0].values.salt).toBe(0.85);
    expect(res.sections.ingredientsText).toContain("Whole wheat flour");
  });

  // Case 2: Two-column per-100g and per-serve with %RDA
  it("Case 2: Two-column per-100g and per-serve with %RDA", () => {
    const text = `
Choco Crunchy Bites
Ingredients: Corn grits, sugar, cocoa powder, palm oil, salt.
Allergen Information: Contains: Soy. May contain: Milk.
Nutrition Information:
Serving Size: 30g
Nutrient Per 100g Per Serving % RDA
Energy 410 kcal 123 kcal 6%
Total Fat 9.0 g 2.7 g 4%
Saturated Fat 4.0 g 1.2 g 6%
Carbohydrates 75.0 g 22.5 g 8%
Total Sugars 28.0 g 8.4 g 17%
Protein 7.0 g 2.1 g 4%
Sodium 300 mg 90 mg 4%
`;
    const res = parseLabelOcr(text);
    expect(res.nutrition.needs_column_choice).toBe(true);
    expect(res.nutrition.columns.length).toBe(2);

    // % values (6%, 4%, etc.) must NEVER be extracted as nutrient values!
    expect(res.nutrition.columns[0].values.energy_kcal).toBe(410);
    expect(res.nutrition.columns[1].values.energy_kcal).toBe(123);
    expect(res.nutrition.columns[0].values.fat).toBe(9.0);
    expect(res.nutrition.columns[1].values.fat).toBe(2.7);

    // Check allergens
    expect(res.allergens.declared).toEqual(["Soy"]);
    expect(res.allergens.traces).toEqual(["Milk"]);
  });

  // Case 3: Per-100 ml beverage
  it("Case 3: Per-100 ml beverage", () => {
    const text = `
Sparkling Berry Infusion
Ingredients: Carbonated water, raspberry juice (5%), citric acid, natural flavours.
Nutrition Facts per 100 ml:
Energy 18 kcal
Fat 0.0 g
Carbohydrate 4.2 g
Sugars 3.8 g
Protein 0.1 g
Salt 0.02 g
`;
    const res = parseLabelOcr(text);
    expect(res.nutrition.detected_basis).toBe("per_100ml");
    expect(res.nutrition.columns[0].values.energy_kcal).toBe(18);
    expect(res.nutrition.columns[0].values.carbohydrates).toBe(4.2);
    expect(res.nutrition.columns[0].values.sugars).toBe(3.8);
    expect(res.nutrition.columns[0].values.protein).toBe(0.1);
  });

  // Case 4: Comma decimals
  it("Case 4: Comma decimals (e.g. 12,5 g)", () => {
    const text = `
European Butter Biscuits
Ingredients: Wheat flour, butter (24%), cane sugar, eggs, sea salt.
Nutrition Information per 100g:
Energy: 485 kcal
Total Fat: 21,5 g
Saturated Fat: 14,2 g
Carbohydrates: 66,4 g
Total Sugars: 24,8 g
Dietary Fibre: 2,1 g
Protein: 6,3 g
Salt: 0,75 g
`;
    const res = parseLabelOcr(text);
    expect(res.nutrition.columns[0].values.fat).toBe(21.5);
    expect(res.nutrition.columns[0].values.saturated_fat).toBe(14.2);
    expect(res.nutrition.columns[0].values.carbohydrates).toBe(66.4);
    expect(res.nutrition.columns[0].values.sugars).toBe(24.8);
    expect(res.nutrition.columns[0].values.protein).toBe(6.3);
    expect(res.nutrition.columns[0].values.salt).toBe(0.75);
  });

  // Case 5: OCR noise (O for 0, l for 1)
  it("Case 5: OCR noise detection (O for 0, l for 1) flagged as ocr_suspect", () => {
    const text = `
Almond Protein Bar
Nutrition Facts per 100g:
Energy: 4l0 kcal
Total Fat: 1O.5 g
Protein: 2O.0 g
Carbohydrates: 35.S g
Salt: 0.5 g
`;
    expect(isOcrSuspect("1O.5")).toBe(true);
    expect(isOcrSuspect("4l0")).toBe(true);
    expect(isOcrSuspect("35.S")).toBe(true);
    expect(isOcrSuspect("0.5")).toBe(false);

    const res = parseLabelOcr(text);
    // Must NOT silently correct!
    expect(res.nutrition.columns[0].suspect_fields.length).toBeGreaterThan(0);
  });

  // Case 6: Missing nutrition section
  it("Case 6: Missing nutrition section", () => {
    const text = `
Natural Honeycomb
Ingredients: 100% Pure Raw Honeycomb.
Packed by: Hive Organic Co, High Valley.
Best Before: 24 months from packaging.
`;
    const res = parseLabelOcr(text);
    expect(res.sections.nutritionText).toBeNull();
    expect(res.nutrition.columns.length).toBe(0);
    expect(res.sections.ingredientsText).toContain("100% Pure Raw Honeycomb");
  });

  // Case 7: Missing ingredients section
  it("Case 7: Missing ingredients section", () => {
    const text = `
Table Salt Co
Nutrition Facts per 100g:
Energy: 0 kcal
Fat: 0 g
Sodium: 38.7 g
Salt: 98.5 g
`;
    const res = parseLabelOcr(text);
    expect(res.sections.ingredientsText).toBeNull();
    expect(res.nutrition.columns[0].values.sodium).toBe(38.7);
    expect(res.nutrition.columns[0].values.salt).toBe(98.5);
  });

  // Case 8: Added sugars separate field
  it("Case 8: Added sugars extracted separately and not merged into total sugars", () => {
    const text = `
Berry Yoghurt Drink
Ingredients: Pasteurized milk, sugar, strawberry pulp, live cultures.
Nutrition Information per 100g:
Energy: 75 kcal
Total Fat: 1.5 g
Carbohydrates: 12.0 g
Total Sugars: 11.5 g
Added Sugars: 6.0 g
Protein: 3.2 g
`;
    const res = parseLabelOcr(text);
    expect(res.nutrition.columns[0].values.sugars).toBe(11.5);
    expect(res.nutrition.columns[0].values.added_sugars).toBe(6.0);
    // Never merged into total sugars
    expect(res.nutrition.columns[0].values.sugars).not.toBe(17.5);
  });

  // Case 9: Salt without sodium and sodium without salt
  it("Case 9: Salt without sodium and sodium without salt", () => {
    const textSalt = `
Snack Mix A
Nutrition per 100g:
Fat: 10g
Salt: 1.2 g
`;
    const textSodium = `
Snack Mix B
Nutrition per 100g:
Fat: 10g
Sodium: 0.48 g
`;
    const resSalt = parseLabelOcr(textSalt);
    expect(resSalt.nutrition.columns[0].values.salt).toBe(1.2);
    expect(resSalt.nutrition.columns[0].values.sodium).toBeNull();

    const resSodium = parseLabelOcr(textSodium);
    expect(resSodium.nutrition.columns[0].values.sodium).toBe(0.48);
    expect(resSodium.nutrition.columns[0].values.salt).toBeNull();
  });

  // Case 10: kJ and kcal together on same line
  it("Case 10: kJ and kcal together on same line", () => {
    const text = `
Dark Roasted Seeds
Nutrition per 100g:
Energy: 1950 kJ / 465 kcal
Fat: 28.0 g
Protein: 18.0 g
`;
    const res = parseLabelOcr(text);
    expect(res.nutrition.columns[0].values.energy_kj).toBe(1950);
    expect(res.nutrition.columns[0].values.energy_kcal).toBe(465);
  });

  // Case 11: Ingredient list wrapped across lines with nested parentheses
  it("Case 11: Ingredient list wrapped across lines with nested parentheses", () => {
    const text = `
Multi-Grain Cereal
Ingredients: Grains (whole wheat (35%), oats (20%), barley flour (10%)),
dried fruit blend (raisins, cranberries (cranberries, sugar, sunflower oil)),
sunflower seeds, emulsifier (soy lecithin (E322)), natural flavouring.
Contains: Wheat, Soy.
Nutrition per 100g:
Energy: 370 kcal
`;
    const res = parseLabelOcr(text);
    expect(res.sections.ingredientsText).toContain("whole wheat (35%)");
    expect(res.sections.ingredientsText).toContain("cranberries, sugar, sunflower oil");
    expect(res.allergens.declared).toEqual(["Wheat", "Soy"]);
  });

  // Case 12: Heading typos (e.g. 'lngredients', 'Nutriton lnformation')
  it("Case 12: Heading typos tolerant parsing", () => {
    const text = `
lngredients: Rice flour, potato starch, vegetable oil, sea salt.
Nutriton lnformation (per 100g):
Energy 420 kcal
Total Fat 12.0 g
Protein 5.0 g
`;
    const res = parseLabelOcr(text);
    expect(res.sections.ingredientsText).toContain("Rice flour");
    expect(res.nutrition.columns[0].values.energy_kcal).toBe(420);
    expect(res.nutrition.columns[0].values.protein).toBe(5.0);
  });

  // Case 13: Gibberish input yields empty results
  it("Case 13: Gibberish input yields empty results without throwing", () => {
    const text = `
xkzjlqpw eiruvbn zmxcvlkj
qwpeoiru zlxknvm asdlfkj
poiuytrewq asdfghjkl mnbvcxz
`;
    const res = parseLabelOcr(text);
    expect(res.sections.ingredientsText).toBeNull();
    expect(res.sections.nutritionText).toBeNull();
    expect(res.nutrition.columns.length).toBe(0);
    expect(res.allergens.declared).toEqual([]);
  });

  // Case 14: Serving size with piece/portion
  it("Case 14: Serving size with piece / portion", () => {
    const text = `
Artisan Cookies
Nutrition per serving:
Serving size: 2 pieces (40g)
Energy: 180 kcal
Fat: 8 g
Carbohydrates: 25 g
`;
    const res = parseLabelOcr(text);
    expect(res.nutrition.detected_basis).toBe("per_serving");
    expect(res.nutrition.serving_size).toBe("40g");
    expect(res.nutrition.columns[0].values.energy_kcal).toBe(180);
  });

  // Case 15: Unmapped micronutrient rows
  it("Case 15: Unmapped micronutrient rows are preserved, never discarded", () => {
    const text = `
Fortified Cereal
Nutrition per 100g:
Energy: 350 kcal
Protein: 8.0 g
Vitamin C: 60 mg
Iron: 14 mg
Zinc: 7.5 mg
`;
    const res = parseLabelOcr(text);
    expect(res.nutrition.columns[0].values.protein).toBe(8.0);
    expect(res.nutrition.unmapped_rows.length).toBeGreaterThanOrEqual(3);
    const unmappedNames = res.nutrition.unmapped_rows.map((r) => r.name.toLowerCase());
    expect(unmappedNames.some((n) => n.includes("vitamin"))).toBe(true);
    expect(unmappedNames.some((n) => n.includes("iron"))).toBe(true);
  });

  // Critical assertion: Every output number appears in the input text
  it("Critical Rule: Every number in parser's output must appear in the input text", () => {
    const testCases = [
      `
Energy: 450 kcal
Fat: 15.5 g
Protein: 12.0 g
Carbs: 60.5 g
Salt: 1.25 g
`,
      `
Nutrition per 100g:
Energy: 1950 kJ / 465 kcal
Saturated Fat: 3.4 g
Sugars: 18.2 g
Fibre: 4.8 g
Sodium: 0.35 g
`,
    ];

    for (const text of testCases) {
      const res = parseLabelOcr(text);
      for (const col of res.nutrition.columns) {
        for (const [key, val] of Object.entries(col.values)) {
          if (val !== null) {
            // Find whether val formatted appears in text
            const valStr = String(val);
            const valCommaStr = valStr.replace(".", ",");
            const appearsInInput =
              text.includes(valStr) ||
              text.includes(valCommaStr) ||
              text.includes(String(Math.round(val)));
            expect(
              appearsInInput,
              `Output number ${val} for key ${key} must appear in the input text: "${text}"`
            ).toBe(true);
          }
        }
      }
    }
  });

  // Provenance tests
  it("Field provenance updates correctly on edit", () => {
    expect(determineProvenance(12.5, 12.5)).toBe("ocr");
    expect(determineProvenance(12.5, 15.0)).toBe("user_corrected");
    expect(determineProvenance(null, 10.0)).toBe("user_corrected");
    expect(determineProvenance(12.5, null)).toBe("missing");
    expect(determineProvenance("Wheat", "Wheat")).toBe("ocr");
    expect(determineProvenance("Wheat", "Oats")).toBe("user_corrected");
  });
});
