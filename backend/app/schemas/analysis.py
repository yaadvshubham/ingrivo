"""Pydantic schemas for Phase 7 AI Explanations and AI Chat."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

from app.schemas.label import LabelEvidence


# --- Request Schemas ---

class BarcodeSource(BaseModel):
    type: Literal["barcode"] = "barcode"
    barcode: str = Field(..., description="8, 12, or 13-digit retail barcode")


class LabelSource(BaseModel):
    type: Literal["label"] = "label"
    evidence: LabelEvidence = Field(..., description="Client-reviewed label text and facts")


class ExplainRequest(BaseModel):
    source: BarcodeSource | LabelSource
    language: Literal["en", "hi", "hinglish"] = "en"


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ProductChatRequest(BaseModel):
    source: BarcodeSource | LabelSource
    messages: list[ChatMessage]
    language: Literal["en", "hi", "hinglish"] = "en"


class ProductChatResponse(BaseModel):
    reply: str
    language: str
    model: str


# --- Response Sub-Models (Structured Gemini Output) ---

class IngredientNote(BaseModel):
    name: str = Field(..., description="Name of the ingredient")
    explanation: str = Field(..., description="Educational function or description in simple plain English")
    basis: Literal["product_evidence", "general_knowledge"] = Field(
        ...,
        description="'product_evidence' if derived from packaging claims/ratios, 'general_knowledge' if general culinary/food science role",
    )


class Observation(BaseModel):
    text: str = Field(..., description="Factual observation directly supported by the product evidence")
    evidence_refs: list[str] = Field(
        default_factory=list,
        description="List of specific evidence field paths (e.g. 'nutrition.sugars', 'ingredients', 'nutrition_basis')",
    )


class AllergenStatement(BaseModel):
    declared: list[str] = Field(default_factory=list, description="Allergens explicitly declared on the label")
    note: str = Field("", description="Educational note regarding allergen warnings and precautionary traces")


class ValidationMeta(BaseModel):
    passed: bool
    retried: bool = False


# --- Top-Level Response Schema ---

class ExplainStructuredData(BaseModel):
    """Clean, flat schema provided directly to Gemini's response_schema."""
    summary: str = Field(..., description="2-3 sentence neutral overview of what this product is and its main nutritional highlights")
    ingredient_notes: list[IngredientNote] = Field(default_factory=list, description="Educational explanations for key ingredients")
    observations: list[Observation] = Field(default_factory=list, description="Factual observations citing explicit evidence references")
    allergen_statement: AllergenStatement = Field(default_factory=AllergenStatement)
    missing_info: list[str] = Field(default_factory=list, description="List of unstated or missing nutritional metrics or ingredient details")
    caveats: list[str] = Field(default_factory=list, description="Important context such as serving sizes, per-100g basis, or dietary notes")


class ExplainResponse(BaseModel):
    ai_status: Literal["available", "unavailable", "not_configured"] = "available"
    model: str
    prompt_version: str
    generated_at: datetime
    summary: str
    ingredient_notes: list[IngredientNote]
    observations: list[Observation]
    allergen_statement: AllergenStatement
    missing_info: list[str]
    caveats: list[str]
    validation: ValidationMeta
    language: str = "en"
