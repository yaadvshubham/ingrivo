"""Evidence packet builder for AI explanations.

Extracts canonical facts from verified barcode products or client-reviewed LabelEvidence.
Excludes images, URLs, user data, and strictly enforces MAX_EVIDENCE_CHARS.
"""

from typing import Any
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.errors import AppError
from app.schemas.label import LabelEvidence
from app.schemas.product import Product


class EvidencePacket(BaseModel):
    """Normalized text-only packet passed to Gemini as DATA."""
    name: str | None = None
    brand: str | None = None
    basis: str | None = None
    serving_size: str | None = None
    ingredients_text: str | None = None
    nutrition: dict[str, Any] = Field(default_factory=dict)
    declared_allergens: list[str] = Field(default_factory=list)
    traces_allergens: list[str] = Field(default_factory=list)
    provenance_flags: dict[str, str] = Field(default_factory=dict)
    missing_fields: list[str] = Field(default_factory=list)
    available_field_paths: list[str] = Field(default_factory=list)


def build_evidence_from_product(product: Product) -> EvidencePacket:
    """Builds evidence from canonical server-fetched Product."""
    nutrients: dict[str, Any] = {}
    missing: list[str] = []
    available_paths: list[str] = []

    if product.name:
        available_paths.append("name")
    else:
        missing.append("name")

    if product.brand:
        available_paths.append("brand")
    else:
        missing.append("brand")

    raw_ingredients = product.ingredients.raw_text or (", ".join(product.ingredients.items) if product.ingredients.items else None)
    if raw_ingredients:
        available_paths.append("ingredients")
    else:
        missing.append("ingredients")

    basis = product.nutrition.basis.value if product.nutrition.basis and product.nutrition.basis.value != "unknown" else None
    if basis:
        available_paths.append("nutrition_basis")
    else:
        missing.append("nutrition_basis")

    serving_size = product.nutrition.serving_size
    if serving_size:
        available_paths.append("serving_size")

    # Check key nutrients
    nutrient_dict = product.nutrition.values.model_dump()
    for k, v in nutrient_dict.items():
        if v is not None:
            nutrients[k] = v
            available_paths.append(f"nutrition.{k}")
        else:
            missing.append(f"nutrition.{k}")

    prov_dict = {
        "name": product.name_provenance.value,
        "brand": product.brand_provenance.value,
        "ingredients": product.ingredients.provenance.value,
        "nutrition": product.nutrition.provenance.value,
        "allergens": product.allergens.provenance.value,
    }

    return EvidencePacket(
        name=product.name,
        brand=product.brand,
        basis=basis if basis else "Not Stated",
        serving_size=serving_size,
        ingredients_text=raw_ingredients,
        nutrition=nutrients,
        declared_allergens=product.allergens.declared,
        traces_allergens=product.allergens.traces,
        provenance_flags={k: v for k, v in prov_dict.items() if v and v != "missing"},
        missing_fields=missing,
        available_field_paths=available_paths,
    )


def build_evidence_from_label(evidence: LabelEvidence) -> EvidencePacket:
    """Builds evidence from validated client LabelEvidence."""
    nutrients: dict[str, Any] = {}
    missing: list[str] = []
    available_paths: list[str] = []

    if evidence.name:
        available_paths.append("name")
    else:
        missing.append("name")

    if evidence.brand:
        available_paths.append("brand")
    else:
        missing.append("brand")

    if evidence.ingredients_text:
        available_paths.append("ingredients")
    else:
        missing.append("ingredients")

    if evidence.nutrition_basis and evidence.nutrition_basis != "unknown":
        available_paths.append("nutrition_basis")
    else:
        missing.append("nutrition_basis")

    if evidence.serving_size:
        available_paths.append("serving_size")

    standard_nutrients = [
        "energy_kcal", "energy_kj", "fat", "saturated_fat",
        "carbohydrates", "sugars", "added_sugars", "fibre", "protein", "salt", "sodium"
    ]

    row_keys_present = set()
    for row in evidence.nutrient_rows:
        if row.value is not None:
            nutrients[row.name] = {"value": row.value, "unit": row.unit}
            row_keys_present.add(row.name.lower())
            available_paths.append(f"nutrition.{row.name.lower()}")

    for sn in standard_nutrients:
        if sn not in row_keys_present:
            missing.append(f"nutrition.{sn}")

    prov_flags = {
        "name": evidence.name_provenance.value,
        "brand": evidence.brand_provenance.value,
        "ingredients": evidence.ingredients_provenance.value,
        "nutrition": evidence.nutrition_provenance.value,
    }

    return EvidencePacket(
        name=evidence.name,
        brand=evidence.brand,
        basis=evidence.nutrition_basis.value if evidence.nutrition_basis != "unknown" else "Not Stated",
        serving_size=evidence.serving_size,
        ingredients_text=evidence.ingredients_text,
        nutrition=nutrients,
        declared_allergens=evidence.allergens_declared,
        traces_allergens=evidence.allergens_traces,
        provenance_flags=prov_flags,
        missing_fields=missing,
        available_field_paths=available_paths,
    )


def serialize_evidence_packet(packet: EvidencePacket) -> str:
    """Serializes packet to clean structured YAML/JSON text for prompt data block.
    
    Enforces MAX_EVIDENCE_CHARS.
    """
    serialized = packet.model_dump_json(indent=2)
    if len(serialized) > settings.MAX_EVIDENCE_CHARS:
        raise AppError(
            code="PAYLOAD_TOO_LARGE",
            message=f"Product evidence exceeds maximum size ({len(serialized)} > {settings.MAX_EVIDENCE_CHARS} chars).",
            status_code=413,
        )
    return serialized
