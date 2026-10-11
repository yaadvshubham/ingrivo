from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class Provenance(str, Enum):
    source = "source"
    ocr = "ocr"
    user_corrected = "user_corrected"
    derived = "derived"
    missing = "missing"


class NutritionBasis(str, Enum):
    per_100g = "per_100g"
    per_100ml = "per_100ml"
    per_serving = "per_serving"
    unknown = "unknown"


class IngredientsData(BaseModel):
    raw_text: Optional[str] = None
    items: List[str] = Field(default_factory=list)
    language: Optional[str] = None
    provenance: Provenance = Provenance.missing


class NutrientValues(BaseModel):
    energy_kcal: Optional[float] = None
    energy_kj: Optional[float] = None
    sugars: Optional[float] = None
    added_sugars: Optional[float] = None  # Phase 6 extension: separate added sugars
    protein: Optional[float] = None
    fat: Optional[float] = None
    saturated_fat: Optional[float] = None
    carbohydrates: Optional[float] = None
    fibre: Optional[float] = None
    sodium: Optional[float] = None
    salt: Optional[float] = None


class NutritionData(BaseModel):
    basis: NutritionBasis = NutritionBasis.unknown
    serving_size: Optional[str] = None
    values: NutrientValues = Field(default_factory=NutrientValues)
    provenance: Provenance = Provenance.missing


class AllergensData(BaseModel):
    declared: List[str] = Field(default_factory=list)
    traces: List[str] = Field(default_factory=list)
    provenance: Provenance = Provenance.missing


class SourceData(BaseModel):
    name: str = "Open Food Facts"
    api_version: str
    product_url: Optional[str] = None
    last_modified: Optional[str] = None
    retrieved_at: str
    license: str = "ODbL"


class CompletenessData(BaseModel):
    score: float
    missing: List[str] = Field(default_factory=list)


class SourceComputedData(BaseModel):
    nutriscore: Optional[str] = None
    nova_group: Optional[int] = None
    additive_tags: List[str] = Field(default_factory=list)


class Product(BaseModel):
    ref: str
    kind: str = "food"
    name: Optional[str] = None
    name_provenance: Provenance = Provenance.missing
    brand: Optional[str] = None
    brand_provenance: Provenance = Provenance.missing
    quantity: Optional[str] = None
    quantity_provenance: Provenance = Provenance.missing
    image_url: Optional[str] = None
    image_provenance: Provenance = Provenance.missing
    categories: List[str] = Field(default_factory=list)
    categories_provenance: Provenance = Provenance.missing
    
    ingredients: IngredientsData = Field(default_factory=IngredientsData)
    nutrition: NutritionData = Field(default_factory=NutritionData)
    allergens: AllergensData = Field(default_factory=AllergensData)
    
    source: SourceData
    completeness: CompletenessData
    source_computed: SourceComputedData = Field(default_factory=SourceComputedData)
