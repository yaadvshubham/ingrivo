"""Pydantic schemas for Phase 8 Product Comparison."""

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

from app.schemas.analysis import BarcodeSource, LabelSource
from app.schemas.product import CompletenessData


# --- Request ---

class CompareRequest(BaseModel):
    a: BarcodeSource | LabelSource
    b: BarcodeSource | LabelSource
    include_ai_explanation: bool = False
    language: Literal["en"] = "en"


# --- Product Summary ---

class CompareProductSummary(BaseModel):
    ref: str
    name: Optional[str] = None
    brand: Optional[str] = None
    image_url: Optional[str] = None
    basis: str
    serving_size: Optional[str] = None
    completeness: CompletenessData


# --- Nutrient Comparison Row ---

class CompareNutrientRow(BaseModel):
    nutrient: str
    label: str
    unit: str
    val_a: Optional[float] = None
    provenance_a: str = "missing"
    derivation_a: Optional[str] = None
    basis_a: str
    val_b: Optional[float] = None
    provenance_b: str = "missing"
    derivation_b: Optional[str] = None
    basis_b: str
    comparable: bool
    incomparable_reason: Optional[str] = None
    diff_absolute: Optional[float] = None
    diff_relative_percent: Optional[float] = None
    direction: Literal["a_higher", "b_higher", "same", "incomparable"]
    notable: bool = False
    notable_reason: Optional[str] = None


# --- Ingredient & Allergen Diffs ---

class IngredientDiff(BaseModel):
    shared: list[str] = Field(default_factory=list)
    only_a: list[str] = Field(default_factory=list)
    only_b: list[str] = Field(default_factory=list)
    is_approximate: bool = True
    disclaimer: str = (
        "Ingredients parsed and matched approximately. Synonyms and formulations may vary."
    )


class AllergenDiff(BaseModel):
    shared: list[str] = Field(default_factory=list)
    only_a: list[str] = Field(default_factory=list)
    only_b: list[str] = Field(default_factory=list)
    note_a: str
    note_b: str


# --- AI Narrative Schemas ---

class CompareAiDifference(BaseModel):
    text: str = Field(
        ...,
        description="Factual, neutral observation about a computed nutrient or ingredient difference",
    )
    evidence_refs: list[str] = Field(
        default_factory=list,
        description="Specific evidence row paths cited, e.g. 'nutrient_rows.sugars', 'ingredients.only_a'",
    )


class CompareAiStructuredData(BaseModel):
    """Schema provided to Gemini for structured comparison narrative."""
    summary: str = Field(
        ...,
        description="2-3 sentence neutral overview of the factual differences without ranking or declaring winners",
    )
    differences: list[CompareAiDifference] = Field(
        default_factory=list,
        description="List of specific factual difference observations citing evidence references",
    )
    limitations: list[str] = Field(
        default_factory=list,
        description="Limitations such as incomparable units, missing nutrients, or approximate ingredient parsing",
    )


class CompareAiResponse(BaseModel):
    summary: str
    differences: list[CompareAiDifference]
    limitations: list[str]
    model: str
    generated_at: datetime
    validation_passed: bool


# --- Top-Level Response ---

class CompareResponse(BaseModel):
    a: CompareProductSummary
    b: CompareProductSummary
    nutrient_rows: list[CompareNutrientRow]
    ingredients_diff: IngredientDiff
    allergens_diff: AllergenDiff
    ai: Optional[CompareAiResponse] = None
    ai_status: Literal["available", "unavailable", "failed", "not_configured", "omitted"] = "omitted"
