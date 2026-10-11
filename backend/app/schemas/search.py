from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class ProductSummary(BaseModel):
    ref: str = Field(description="Canonical reference: 'bc-<barcode>'")
    name: Optional[str] = Field(None, description="Product title from source")
    brand: Optional[str] = Field(None, description="Brand name from source")
    image_url: Optional[str] = Field(None, description="Product front thumbnail URL")
    categories: List[str] = Field(default_factory=list, description="Up to 2 representative categories")
    has_ingredients: bool = Field(description="Whether ingredients list or items are present in source")
    nutrition_availability: Literal["none", "partial", "most"] = Field(
        description="Nutritional data availability classification computed from key nutrient presence"
    )
    source: str = Field(default="Open Food Facts", description="Data provenance attribution")


class SearchResponse(BaseModel):
    query: str
    page: int
    page_size: int
    total: Optional[int] = None
    page_count: int
    results: List[ProductSummary]
