import json
from pathlib import Path
import pytest
from pydantic import ValidationError
from app.schemas.label import LabelEvidence, LabelNutrientRow
from app.schemas.product import NutritionBasis, Provenance
from app.services.normalizer import normalize_off_product


def test_label_evidence_valid():
    evidence = LabelEvidence(
        ref="lb-123e4567-e89b-12d3-a456-426614174000",
        name="Healthy Granola",
        brand="SuperFoods",
        ingredients_text="Rolled oats, honey, almonds.",
        allergens_declared=["Almonds"],
        allergens_traces=["Peanuts"],
        nutrition_basis=NutritionBasis.per_100g,
        serving_size="40g",
        nutrient_rows=[
            LabelNutrientRow(name="Energy", value=420.0, unit="kcal"),
            LabelNutrientRow(name="Protein", value=10.5, unit="g"),
            LabelNutrientRow(name="Total Fat", value=14.0, unit="g"),
        ],
        user_confirmed=True
    )
    assert evidence.ref.startswith("lb-")
    assert evidence.name == "Healthy Granola"
    assert len(evidence.nutrient_rows) == 3


def test_label_evidence_control_characters_stripped():
    evidence = LabelEvidence(
        ref="lb-123e4567-e89b-12d3-a456-426614174000",
        name="Bad\x00Text\x1fProduct",
        brand="Clean\x08Brand",
        ingredients_text="Wheat flour\x07, sugar.",
        allergens_declared=["Wheat\x02"],
        nutrient_rows=[
            LabelNutrientRow(name="Energy\x01", value=200.0, unit="kcal\x03")
        ]
    )
    assert evidence.name == "BadTextProduct"
    assert evidence.brand == "CleanBrand"
    assert evidence.ingredients_text == "Wheat flour, sugar."
    assert evidence.allergens_declared == ["Wheat"]
    assert evidence.nutrient_rows[0].name == "Energy"
    assert evidence.nutrient_rows[0].unit == "kcal"


def test_label_evidence_invalid_ref():
    with pytest.raises(ValidationError):
        LabelEvidence(ref="invalid-ref-123")


def test_label_evidence_ingredients_too_long():
    with pytest.raises(ValidationError):
        LabelEvidence(
            ref="lb-123e4567-e89b-12d3-a456-426614174000",
            ingredients_text="a" * 3001
        )


def test_label_evidence_too_many_nutrient_rows():
    rows = [LabelNutrientRow(name=f"Nutrient {i}", value=float(i)) for i in range(21)]
    with pytest.raises(ValidationError):
        LabelEvidence(
            ref="lb-123e4567-e89b-12d3-a456-426614174000",
            nutrient_rows=rows
        )


def test_label_evidence_negative_nutrient_value():
    with pytest.raises(ValidationError):
        LabelNutrientRow(name="Fat", value=-5.0)


def test_shared_completeness_fixtures_against_backend():
    fixture_path = Path(__file__).resolve().parents[2] / "docs" / "shared-fixtures" / "completeness-cases.json"
    assert fixture_path.exists(), f"Shared fixture not found at {fixture_path}"

    with open(fixture_path, "r", encoding="utf-8") as f:
        test_cases = json.load(f)

    for case in test_cases:
        inp = case["input"]
        expected = case["expected"]

        # Simulate OFF product payload matching normalizer input
        basis_val = inp["basis"]
        nutrition_data_per = "100g" if basis_val == "per_100g" else ("100ml" if basis_val == "per_100ml" else ("serving" if basis_val == "per_serving" else None))

        raw_data = {
            "code": "1234567890123",
            "product_name": inp["name"],
            "brands": inp["brand"],
            "ingredients_text": inp["ingredients_text"],
            "nutrition_data_per": nutrition_data_per,
            "nutriments": {}
        }
        if inp["energy_kcal"] is not None:
            raw_data["nutriments"]["energy-kcal"] = inp["energy_kcal"]
        if inp["energy_kj"] is not None:
            raw_data["nutriments"]["energy-kj"] = inp["energy_kj"]
        if inp["sugars"] is not None:
            raw_data["nutriments"]["sugars"] = inp["sugars"]
        if inp["protein"] is not None:
            raw_data["nutriments"]["proteins"] = inp["protein"]
        if inp["fat"] is not None:
            raw_data["nutriments"]["fat"] = inp["fat"]
        if inp["saturated_fat"] is not None:
            raw_data["nutriments"]["saturated-fat"] = inp["saturated_fat"]
        if inp["carbohydrates"] is not None:
            raw_data["nutriments"]["carbohydrates"] = inp["carbohydrates"]
        if inp["fibre"] is not None:
            raw_data["nutriments"]["fiber"] = inp["fibre"]
        if inp["sodium"] is not None:
            raw_data["nutriments"]["sodium"] = inp["sodium"]
        if inp["salt"] is not None:
            raw_data["nutriments"]["salt"] = inp["salt"]

        prod = normalize_off_product(raw_data, "v2")
        assert prod.completeness.score == expected["score"], f"Failed for {case['description']}: got {prod.completeness.score}, expected {expected['score']}"
        assert set(prod.completeness.missing) == set(expected["missing"]), f"Failed missing for {case['description']}"
