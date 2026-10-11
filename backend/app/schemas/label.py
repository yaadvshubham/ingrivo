import re
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from app.schemas.product import NutritionBasis, Provenance

# Regex to strip ascii control characters except standard whitespace (\n, \r, \t)
CONTROL_CHARS_REGEX = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_string(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = CONTROL_CHARS_REGEX.sub("", value).strip()
    return cleaned if cleaned else None


class LabelNutrientRow(BaseModel):
    name: str = Field(..., max_length=100)
    value: Optional[float] = Field(None, ge=0, le=100000)
    unit: Optional[str] = Field(None, max_length=20)
    ocr_suspect: bool = False
    low_confidence: bool = False
    provenance: Provenance = Provenance.ocr

    @field_validator("name", "unit", mode="before")
    @classmethod
    def clean_text(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_string(v)


class LabelEvidence(BaseModel):
    ref: str = Field(..., pattern=r"^lb-[a-f0-9-]+$")
    kind: str = "label_product"
    name: Optional[str] = Field(None, max_length=200)
    name_provenance: Provenance = Provenance.missing
    brand: Optional[str] = Field(None, max_length=200)
    brand_provenance: Provenance = Provenance.missing

    ingredients_text: Optional[str] = Field(None, max_length=3000)
    ingredients_provenance: Provenance = Provenance.missing

    allergens_declared: List[str] = Field(default_factory=list, max_length=50)
    allergens_traces: List[str] = Field(default_factory=list, max_length=50)
    allergens_provenance: Provenance = Provenance.missing

    nutrition_basis: NutritionBasis = NutritionBasis.unknown
    serving_size: Optional[str] = Field(None, max_length=100)
    nutrient_rows: List[LabelNutrientRow] = Field(default_factory=list, max_length=20)
    nutrition_provenance: Provenance = Provenance.missing

    user_confirmed: bool = True
    created_at: Optional[str] = None

    @field_validator("name", "brand", "ingredients_text", "serving_size", mode="before")
    @classmethod
    def clean_strings(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_string(v)

    @field_validator("allergens_declared", "allergens_traces", mode="before")
    @classmethod
    def clean_allergen_lists(cls, v: List[str]) -> List[str]:
        if not v:
            return []
        cleaned_list = []
        for item in v:
            c = sanitize_string(item)
            if c:
                cleaned_list.append(c)
        return cleaned_list
