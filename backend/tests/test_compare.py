"""Unit and Integration Tests for Product Comparison (Phase 8)."""

import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch

from app.main import app
from app.core.ai_policy import COMPARE_PROHIBITED_STRINGS
from app.core.errors import AppError
from app.schemas.compare import (
    AllergenDiff,
    CompareAiDifference,
    CompareAiStructuredData,
    CompareNutrientRow,
    CompareProductSummary,
    IngredientDiff,
)
from app.schemas.label import LabelEvidence, LabelNutrientRow
from app.schemas.product import (
    AllergensData,
    CompletenessData,
    IngredientsData,
    NutrientValues,
    NutritionBasis,
    NutritionData,
    Product,
    Provenance,
    SourceData,
)
from app.services.compare import (
    NOTABLE_ABSOLUTE_FLOORS,
    build_deterministic_comparison,
    label_evidence_to_product,
    parse_ingredient_tokens,
    parse_serving_size,
    serialize_comparison_packet,
    validate_compare_narrative,
)


def create_dummy_product(
    ref: str = "bc-1234567890123",
    name: str = "Sample Food",
    brand: str = "Demo Brand",
    basis: NutritionBasis = NutritionBasis.per_100g,
    serving_size: str | None = None,
    nutrients: dict | None = None,
    ingredients_text: str = "Wheat flour (niacin, iron), sugar, salt.",
    declared_allergens: list[str] | None = None,
) -> Product:
    nv = NutrientValues(
        energy_kcal=nutrients.get("energy_kcal") if nutrients else 200.0,
        energy_kj=nutrients.get("energy_kj") if nutrients else 840.0,
        fat=nutrients.get("fat") if nutrients else 5.0,
        saturated_fat=nutrients.get("saturated_fat") if nutrients else 1.0,
        carbohydrates=nutrients.get("carbohydrates") if nutrients else 30.0,
        sugars=nutrients.get("sugars") if nutrients else 10.0,
        added_sugars=nutrients.get("added_sugars") if nutrients else None,
        fibre=nutrients.get("fibre") if nutrients else 2.0,
        protein=nutrients.get("protein") if nutrients else 4.0,
        salt=nutrients.get("salt") if nutrients else 0.5,
        sodium=nutrients.get("sodium") if nutrients else 0.2,
    ) if nutrients is not None else NutrientValues(
        energy_kcal=200.0,
        energy_kj=840.0,
        fat=5.0,
        saturated_fat=1.0,
        carbohydrates=30.0,
        sugars=10.0,
        fibre=2.0,
        protein=4.0,
        salt=0.5,
        sodium=0.2,
    )

    actual_allergens = ["Gluten"] if declared_allergens is None else declared_allergens

    return Product(
        ref=ref,
        name=name,
        brand=brand,
        ingredients=IngredientsData(
            raw_text=ingredients_text,
            items=[],
            provenance=Provenance.source,
        ),
        nutrition=NutritionData(
            basis=basis,
            serving_size=serving_size,
            values=nv,
            provenance=Provenance.source,
        ),
        allergens=AllergensData(
            declared=actual_allergens,
            traces=[],
            provenance=Provenance.source if actual_allergens else Provenance.missing,
        ),
        source=SourceData(
            api_version="v2",
            retrieved_at="2026-10-12T00:00:00Z",
        ),
        completeness=CompletenessData(score=1.0, missing=[]),
    )


# --- 1. Comparability Rules & Serving Normalization Tests ---

def test_comparable_per_100g_vs_per_100g():
    p1 = create_dummy_product(ref="p1", basis=NutritionBasis.per_100g)
    p2 = create_dummy_product(ref="p2", basis=NutritionBasis.per_100g)
    _, _, rows, _, _ = build_deterministic_comparison(p1, p2)

    sugar_row = next(r for r in rows if r.nutrient == "sugars")
    assert sugar_row.comparable is True
    assert sugar_row.incomparable_reason is None
    assert sugar_row.direction == "same"


def test_comparable_per_100ml_vs_per_100ml():
    p1 = create_dummy_product(ref="p1", basis=NutritionBasis.per_100ml)
    p2 = create_dummy_product(ref="p2", basis=NutritionBasis.per_100ml)
    _, _, rows, _, _ = build_deterministic_comparison(p1, p2)

    fat_row = next(r for r in rows if r.nutrient == "fat")
    assert fat_row.comparable is True
    assert fat_row.direction == "same"


def test_incomparable_g_vs_ml():
    p1 = create_dummy_product(ref="p1", basis=NutritionBasis.per_100g)
    p2 = create_dummy_product(ref="p2", basis=NutritionBasis.per_100ml)
    _, _, rows, _, _ = build_deterministic_comparison(p1, p2)

    present_rows = [r for r in rows if r.nutrient in ("sugars", "fat", "carbohydrates", "energy_kcal")]
    for row in present_rows:
        assert row.comparable is False
        assert "Different basis units" in (row.incomparable_reason or "")
        assert row.direction == "incomparable"
        assert row.diff_absolute is None


def test_incomparable_basis_unknown():
    p1 = create_dummy_product(ref="p1", basis=NutritionBasis.unknown)
    p2 = create_dummy_product(ref="p2", basis=NutritionBasis.per_100g)
    _, _, rows, _, _ = build_deterministic_comparison(p1, p2)

    present_rows = [r for r in rows if r.nutrient in ("sugars", "fat", "carbohydrates")]
    for row in present_rows:
        assert row.comparable is False
        assert "unknown or unstated" in (row.incomparable_reason or "")


def test_per_serving_conversion_when_known_in_grams():
    # 25g serving with 5g sugar -> per 100g should be 20g sugar (4x)
    p1 = create_dummy_product(
        ref="p1",
        basis=NutritionBasis.per_serving,
        serving_size="25 g",
        nutrients={"sugars": 5.0, "fat": 2.0},
    )
    p2 = create_dummy_product(
        ref="p2",
        basis=NutritionBasis.per_100g,
        nutrients={"sugars": 15.0, "fat": 8.0},
    )
    _, _, rows, _, _ = build_deterministic_comparison(p1, p2)

    sugar_row = next(r for r in rows if r.nutrient == "sugars")
    assert sugar_row.comparable is True
    assert sugar_row.val_a == 20.0  # 5 * 4
    assert sugar_row.provenance_a == "derived"
    assert "Converted from 25g serving" in (sugar_row.derivation_a or "")
    assert sugar_row.val_b == 15.0
    assert sugar_row.direction == "a_higher"
    assert sugar_row.diff_absolute == 5.0


def test_per_serving_incomparable_when_serving_size_unknown():
    p1 = create_dummy_product(
        ref="p1",
        basis=NutritionBasis.per_serving,
        serving_size=None,
    )
    p2 = create_dummy_product(ref="p2", basis=NutritionBasis.per_100g)
    _, _, rows, _, _ = build_deterministic_comparison(p1, p2)

    present_rows = [r for r in rows if r.nutrient in ("sugars", "fat", "carbohydrates")]
    for row in present_rows:
        assert row.comparable is False
        assert "Serving size weight/volume is unknown" in (row.incomparable_reason or "")


# --- 2. Derived Cross-Conversions: Sodium <-> Salt & Energy kcal <-> kJ ---

def test_derived_conversion_salt_to_sodium():
    # P1 has salt=1.0g, missing sodium. P2 has sodium=0.4g, salt=1.0g
    p1 = create_dummy_product(ref="p1", nutrients={"salt": 1.0, "sodium": None})
    p2 = create_dummy_product(ref="p2", nutrients={"salt": 1.0, "sodium": 0.4})
    _, _, rows, _, _ = build_deterministic_comparison(p1, p2)

    sodium_row = next(r for r in rows if r.nutrient == "sodium")
    assert sodium_row.comparable is True
    assert sodium_row.val_a == 0.4  # 1.0 / 2.5
    assert sodium_row.provenance_a == "derived"
    assert "Calculated from salt (salt / 2.5)" in (sodium_row.derivation_a or "")


def test_derived_conversion_sodium_to_salt():
    p1 = create_dummy_product(ref="p1", nutrients={"salt": None, "sodium": 0.2})
    p2 = create_dummy_product(ref="p2", nutrients={"salt": 0.5, "sodium": 0.2})
    _, _, rows, _, _ = build_deterministic_comparison(p1, p2)

    salt_row = next(r for r in rows if r.nutrient == "salt")
    assert salt_row.comparable is True
    assert salt_row.val_a == 0.5  # 0.2 * 2.5
    assert salt_row.provenance_a == "derived"
    assert "Calculated from sodium" in (salt_row.derivation_a or "")


def test_derived_conversion_energy_kj_to_kcal():
    p1 = create_dummy_product(ref="p1", nutrients={"energy_kcal": None, "energy_kj": 418.4})
    p2 = create_dummy_product(ref="p2", nutrients={"energy_kcal": 100.0, "energy_kj": 418.4})
    _, _, rows, _, _ = build_deterministic_comparison(p1, p2)

    kcal_row = next(r for r in rows if r.nutrient == "energy_kcal")
    assert kcal_row.comparable is True
    assert kcal_row.val_a == 100.0  # 418.4 / 4.184
    assert kcal_row.provenance_a == "derived"


# --- 3. Missing Data on One Side vs Both Sides ---

def test_missing_on_one_side():
    p1 = create_dummy_product(ref="p1", nutrients={"fibre": 5.0})
    p2 = create_dummy_product(ref="p2", nutrients={"fibre": None})
    _, _, rows, _, _ = build_deterministic_comparison(p1, p2)

    fibre_row = next(r for r in rows if r.nutrient == "fibre")
    assert fibre_row.comparable is False
    assert fibre_row.val_a == 5.0
    assert fibre_row.val_b is None
    assert fibre_row.incomparable_reason == "Not available for Product B"
    assert fibre_row.direction == "incomparable"


def test_missing_on_both_sides():
    p1 = create_dummy_product(ref="p1", nutrients={"added_sugars": None})
    p2 = create_dummy_product(ref="p2", nutrients={"added_sugars": None})
    _, _, rows, _, _ = build_deterministic_comparison(p1, p2)

    added_sugars_row = next(r for r in rows if r.nutrient == "added_sugars")
    assert added_sugars_row.comparable is False
    assert added_sugars_row.val_a is None
    assert added_sugars_row.val_b is None
    assert added_sugars_row.incomparable_reason == "Not available for both products"


# --- 4. Notable Threshold & Floor Edge Cases ---

def test_notable_flag_exceeds_relative_and_floor():
    # Sugars floor is 1.0g. 10g vs 13g: rel diff = (3 / 10) * 100 = 30% (>=20%), abs diff = 3g (>=1g) -> NOTABLE
    p1 = create_dummy_product(ref="p1", nutrients={"sugars": 10.0})
    p2 = create_dummy_product(ref="p2", nutrients={"sugars": 13.0})
    _, _, rows, _, _ = build_deterministic_comparison(p1, p2)

    sugar_row = next(r for r in rows if r.nutrient == "sugars")
    assert sugar_row.notable is True
    assert sugar_row.notable_reason is not None
    assert "Relative difference of 30.0% exceeds 20%" in sugar_row.notable_reason


def test_notable_flag_fails_when_below_absolute_floor():
    # Salt floor is 0.1g. 0.05g vs 0.07g: rel diff is 40% (>=20%), but abs diff is 0.02g (< 0.1g floor) -> NOT NOTABLE
    p1 = create_dummy_product(ref="p1", nutrients={"salt": 0.05, "sodium": 0.02})
    p2 = create_dummy_product(ref="p2", nutrients={"salt": 0.07, "sodium": 0.028})
    _, _, rows, _, _ = build_deterministic_comparison(p1, p2)

    salt_row = next(r for r in rows if r.nutrient == "salt")
    assert salt_row.notable is False
    assert salt_row.notable_reason is None


# --- 5. Identical Products ---

def test_identical_products():
    p1 = create_dummy_product(ref="p1")
    _, _, rows, ing_diff, allergen_diff = build_deterministic_comparison(p1, p1)

    for row in rows:
        if row.comparable:
            assert row.direction == "same"
            assert row.diff_absolute == 0.0
            assert row.notable is False

    assert len(ing_diff.only_a) == 0
    assert len(ing_diff.only_b) == 0
    assert len(ing_diff.shared) > 0


# --- 6. Ingredient Diff with Nested Parentheses ---

def test_ingredient_diff_parentheses_parsing():
    text_a = "wheat flour (wheat, iron, folic acid), sugar 25%, sea salt, palm oil."
    text_b = "wheat flour, corn syrup, sea salt, canola oil."

    tokens_a = parse_ingredient_tokens(text_a)
    tokens_b = parse_ingredient_tokens(text_b)

    assert "wheat flour (wheat, iron, folic acid)" in tokens_a
    assert "sugar" in tokens_a  # "25%" stripped
    assert "sea salt" in tokens_a

    p1 = create_dummy_product(ref="p1", ingredients_text=text_a)
    p2 = create_dummy_product(ref="p2", ingredients_text=text_b)
    _, _, _, ing_diff, _ = build_deterministic_comparison(p1, p2)

    assert "sea salt" in ing_diff.shared
    assert "palm oil" in ing_diff.only_a
    assert "canola oil" in ing_diff.only_b
    assert ing_diff.is_approximate is True


# --- 7. Allergen Diff: Empty is Not Allergen-Free ---

def test_allergen_diff_empty_vs_listed():
    p1 = create_dummy_product(ref="p1", declared_allergens=[])
    p2 = create_dummy_product(ref="p2", declared_allergens=["Soybeans", "Milk"])
    _, _, _, _, allergen_diff = build_deterministic_comparison(p1, p2)

    assert len(allergen_diff.shared) == 0
    assert len(allergen_diff.only_a) == 0
    assert "Milk" in allergen_diff.only_b
    assert "None listed in source" in allergen_diff.note_a
    assert "Declared on label" in allergen_diff.note_b


# --- 8. AI Narrative Validator: Neutrality & Number Grounding ---

def test_validator_rejects_ranking_language():
    data = CompareAiStructuredData(
        summary="Product A is much healthier and clearly the better winner.",
        differences=[
            CompareAiDifference(
                text="You should choose Product A because Product B is unhealthy.",
                evidence_refs=["nutrient_rows.sugars"],
            )
        ],
        limitations=[],
    )
    packet = "PRODUCT_A: name=\"P1\"\nPRODUCT_B: name=\"P2\"\nCOMPUTED_NUTRIENT_DIFFERENCES:\n- row path: nutrient_rows.sugars | Sugars: diff=2.0 g"
    nutrient_rows = [
        CompareNutrientRow(
            nutrient="sugars",
            label="Total Sugars",
            unit="g",
            val_a=10.0,
            provenance_a="source",
            basis_a="per_100g",
            val_b=12.0,
            provenance_b="source",
            basis_b="per_100g",
            comparable=True,
            diff_absolute=2.0,
            diff_relative_percent=20.0,
            direction="b_higher",
            notable=True,
        )
    ]

    result = validate_compare_narrative(data, packet, nutrient_rows)
    assert result.is_valid is False
    assert any("healthier" in err for err in result.errors)
    assert any("better" in err or "winner" in err for err in result.errors)


def test_validator_accepts_neutral_grounded_wording():
    data = CompareAiStructuredData(
        summary="Product A provides 10.0 g total sugars per 100 g, while Product B contains 12.0 g.",
        differences=[
            CompareAiDifference(
                text="Product B is higher in total sugars by 2.0 g (+20.0%).",
                evidence_refs=["nutrient_rows.sugars"],
            )
        ],
        limitations=["Serving sizes were not evaluated."],
    )
    packet = "PRODUCT_A: name=\"P1\"\nPRODUCT_B: name=\"P2\"\nCOMPUTED_NUTRIENT_DIFFERENCES:\n- row path: nutrient_rows.sugars | Sugars: A=10.0, B=12.0, diff=2.0, +20.0%"
    nutrient_rows = [
        CompareNutrientRow(
            nutrient="sugars",
            label="Total Sugars",
            unit="g",
            val_a=10.0,
            provenance_a="source",
            basis_a="per_100g",
            val_b=12.0,
            provenance_b="source",
            basis_b="per_100g",
            comparable=True,
            diff_absolute=2.0,
            diff_relative_percent=20.0,
            direction="b_higher",
            notable=True,
        )
    ]

    result = validate_compare_narrative(data, packet, nutrient_rows)
    assert result.is_valid is True
    assert len(result.errors) == 0


# --- 9. Integration / Router Tests with Side Attribution ---

@pytest.mark.anyio
async def test_compare_endpoint_slot_error_attribution():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Invalid barcode in slot A
        resp_a = await client.post(
            "/api/v1/compare",
            json={
                "a": {"type": "barcode", "barcode": "999"},
                "b": {"type": "barcode", "barcode": "5449000000996"},
            },
        )
        assert resp_a.status_code == 400
        err_a = resp_a.json()["error"]
        assert err_a["code"] == "INVALID_BARCODE"
        assert err_a["details"]["side"] == "a"

        # Invalid barcode in slot B
        resp_b = await client.post(
            "/api/v1/compare",
            json={
                "a": {"type": "barcode", "barcode": "5449000000996"},
                "b": {"type": "barcode", "barcode": "invalid"},
            },
        )
        assert resp_b.status_code == 400
        err_b = resp_b.json()["error"]
        assert err_b["code"] == "INVALID_BARCODE"
        assert err_b["details"]["side"] == "b"


@pytest.mark.anyio
async def test_compare_endpoint_with_label_and_barcode():
    import json
    from pathlib import Path
    fixture_file = Path(__file__).parent / "fixtures" / "off" / "5449000000996.json"
    with open(fixture_file, "r", encoding="utf-8") as f:
        fixture_data = json.load(f)

    label_evidence = {
        "ref": "lb-12345678-1234-5678-1234-567812345678",
        "kind": "label_product",
        "name": "Oat Crunch",
        "brand": "Demo Brands",
        "ingredients_text": "Rolled oats, cane sugar, sunflower oil.",
        "allergens_declared": ["Oats"],
        "allergens_traces": [],
        "nutrition_basis": "per_100g",
        "nutrient_rows": [
            {"name": "sugars", "value": 15.0, "unit": "g"},
            {"name": "fat", "value": 8.0, "unit": "g"},
            {"name": "salt", "value": 0.2, "unit": "g"},
        ],
        "user_confirmed": True,
    }

    with patch("app.routers.compare.fetch_off_product", new=AsyncMock(return_value=fixture_data)):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/compare",
                json={
                    "a": {"type": "barcode", "barcode": "5449000000996"},
                    "b": {"type": "label", "evidence": label_evidence},
                    "include_ai_explanation": False,
                },
            )
            assert resp.status_code == 200
            data = resp.json()

            assert data["a"]["ref"] == "bc-5449000000996"
            assert data["b"]["ref"] == label_evidence["ref"]
            assert len(data["nutrient_rows"]) > 0
            assert data["ai_status"] == "omitted"
            assert data["ai"] is None
