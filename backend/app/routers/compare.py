"""Comparison Router (Phase 8)."""

from fastapi import APIRouter, Request

from app.core.config import settings
from app.core.cache import product_cache
from app.core.errors import AppError
from app.core.rate_limit import get_client_ip
from app.schemas.compare import CompareRequest, CompareResponse
from app.schemas.product import Product
from app.services.ai_cache import client_limiter
from app.services.barcode import is_valid_barcode, normalize_barcode
from app.services.compare import (
    build_deterministic_comparison,
    generate_compare_ai_narrative,
    label_evidence_to_product,
)
from app.services.normalizer import normalize_off_product
from app.services.off_client import (
    ProductNotFound,
    UpstreamRateLimited,
    UpstreamTimeout,
    fetch_off_product,
)

router = APIRouter(prefix="/api/v1", tags=["compare"])


async def resolve_product_slot(source, side: str) -> Product:
    """Resolves a slot source (barcode or label) into a canonical Product with error attribution."""
    if source.type == "barcode":
        if not is_valid_barcode(source.barcode):
            raise AppError(
                code="INVALID_BARCODE",
                message=f"Invalid barcode format for slot {side.upper()}: '{source.barcode}'.",
                status_code=400,
                details={"side": side, "barcode": source.barcode},
            )
        clean_bc = normalize_barcode(source.barcode)

        cached = product_cache.get(clean_bc)
        if cached:
            return cached

        try:
            raw_data = await fetch_off_product(clean_bc)
            product = normalize_off_product(raw_data, api_version=settings.OFF_API_VERSION)
            product_cache.set(clean_bc, product, ttl=86400)
            return product
        except ProductNotFound:
            raise AppError(
                code="PRODUCT_NOT_FOUND",
                message=f"Product for slot {side.upper()} (barcode {clean_bc}) not found in Open Food Facts.",
                status_code=404,
                details={"side": side, "ref": f"bc-{clean_bc}", "barcode": clean_bc},
            )
        except UpstreamTimeout:
            raise AppError(
                code="UPSTREAM_TIMEOUT",
                message=f"Open Food Facts connection timed out while loading slot {side.upper()}.",
                status_code=504,
                details={"side": side},
            )
        except UpstreamRateLimited:
            raise AppError(
                code="UPSTREAM_RATE_LIMITED",
                message=f"Open Food Facts rate limited while loading slot {side.upper()}.",
                status_code=429,
                details={"side": side},
            )
    elif source.type == "label":
        return label_evidence_to_product(source.evidence)
    else:
        raise AppError(
            code="INVALID_SOURCE_TYPE",
            message=f"Unsupported source type '{getattr(source, 'type', None)}' for slot {side.upper()}.",
            status_code=400,
            details={"side": side},
        )


@router.post("/compare", response_model=CompareResponse)
async def compare_products(request: Request, body: CompareRequest):
    """Computes deterministic nutrient, ingredient, and allergen comparisons between two products."""
    # 1. Resolve Product A & B
    prod_a = await resolve_product_slot(body.a, side="a")
    prod_b = await resolve_product_slot(body.b, side="b")

    # 2. Build deterministic comparison
    summary_a, summary_b, nutrient_rows, ing_diff, allergen_diff = build_deterministic_comparison(
        prod_a, prod_b
    )

    # 3. Optional AI narrative
    ai_narrative = None
    ai_status = "omitted"

    if body.include_ai_explanation:
        client_ip = get_client_ip(request)
        client_limiter.check_limit(client_ip)

        ai_narrative, ai_status = await generate_compare_ai_narrative(
            summary_a, summary_b, nutrient_rows, ing_diff, allergen_diff
        )

    return CompareResponse(
        a=summary_a,
        b=summary_b,
        nutrient_rows=nutrient_rows,
        ingredients_diff=ing_diff,
        allergens_diff=allergen_diff,
        ai=ai_narrative,
        ai_status=ai_status,
    )
