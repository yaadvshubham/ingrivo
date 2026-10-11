"""Analysis router for structured AI explanations (Phase 7)."""

from datetime import datetime, timezone
from fastapi import APIRouter, Request

from app.core.config import settings
from app.core.errors import AppError
from app.core.rate_limit import get_client_ip
from app.core.cache import product_cache
from app.schemas.analysis import (
    ExplainRequest,
    ExplainResponse,
    ExplainStructuredData,
    ValidationMeta,
)
from app.services.ai_cache import client_limiter, daily_quota, explanation_cache
from app.services.ai_validator import validate_explanation
from app.services.barcode import normalize_barcode
from app.services.evidence import (
    build_evidence_from_label,
    build_evidence_from_product,
    serialize_evidence_packet,
)
from app.services.gemini_client import gemini_client
from app.services.normalizer import normalize_off_product
from app.services.off_client import (
    fetch_off_product,
    ProductNotFound,
    UpstreamRateLimited,
    UpstreamTimeout,
)
from app.services.prompts import PROMPT_VERSION, SYSTEM_INSTRUCTION, build_user_prompt

router = APIRouter(prefix="/api/v1/analysis", tags=["analysis"])


@router.post("/explain", response_model=ExplainResponse)
async def explain_product(request: Request, body: ExplainRequest):
    """Generates an educational, structured explanation of a packaged food product."""
    # 1. Check AI configuration
    if not settings.gemini_configured:
        raise AppError(
            code="AI_NOT_CONFIGURED",
            message="Gemini AI explanations are not configured on this server.",
            status_code=503,
        )

    # 2. Check per-client rate limit and daily quota
    client_ip = get_client_ip(request)
    client_limiter.check_limit(client_ip)
    daily_quota.check_and_increment()

    # 3. Build canonical evidence packet
    if body.source.type == "barcode":
        clean_barcode = normalize_barcode(body.source.barcode)
        cached_product = product_cache.get(clean_barcode)
        if not cached_product:
            try:
                raw_data = await fetch_off_product(clean_barcode)
                cached_product = normalize_off_product(raw_data)
                product_cache.set(clean_barcode, cached_product)
            except ProductNotFound:
                raise AppError(code="PRODUCT_NOT_FOUND", message=f"Product {clean_barcode} not found in database.", status_code=404)
            except UpstreamTimeout:
                raise AppError(code="UPSTREAM_TIMEOUT", message="Open Food Facts timed out.", status_code=504)
            except UpstreamRateLimited:
                raise AppError(code="UPSTREAM_RATE_LIMITED", message="Open Food Facts rate limited.", status_code=429)

        evidence = build_evidence_from_product(cached_product)
    else:
        evidence = build_evidence_from_label(body.source.evidence)

    # 4. Serialize evidence and enforce character ceiling
    serialized_evidence = serialize_evidence_packet(evidence)

    # 5. Check in-memory 24h explanation cache
    cache_key = explanation_cache.compute_key(
        serialized_evidence, PROMPT_VERSION, settings.GEMINI_MODEL
    )
    cached_response = explanation_cache.get(cache_key)
    if cached_response:
        return cached_response

    # 6. Generate via Gemini (Attempt 1)
    user_prompt = build_user_prompt(serialized_evidence)
    parsed_data, meta = await gemini_client.generate_structured(
        system_instruction=SYSTEM_INSTRUCTION,
        user_prompt=user_prompt,
        response_schema=ExplainStructuredData,
    )

    # 7. Strict Veracity & Policy Validation
    val_result = validate_explanation(parsed_data, evidence)
    was_retried = False

    if not val_result.is_valid:
        # One validation retry with error feedback
        was_retried = True
        retry_feedback = "\n".join(f"- {err}" for err in val_result.errors)
        retry_prompt = build_user_prompt(serialized_evidence, retry_feedback=retry_feedback)

        parsed_data, meta = await gemini_client.generate_structured(
            system_instruction=SYSTEM_INSTRUCTION,
            user_prompt=retry_prompt,
            response_schema=ExplainStructuredData,
        )

        val_result = validate_explanation(parsed_data, evidence)
        if not val_result.is_valid:
            raise AppError(
                code="AI_INVALID_OUTPUT",
                message="The AI model generated ungrounded numbers or prohibited claims that failed verification.",
                status_code=502,
                details={"errors": val_result.errors},
            )

    # 8. Assemble response
    response = ExplainResponse(
        ai_status="available",
        model=settings.GEMINI_MODEL,
        prompt_version=PROMPT_VERSION,
        generated_at=datetime.now(timezone.utc),
        summary=parsed_data.summary,
        ingredient_notes=parsed_data.ingredient_notes,
        observations=parsed_data.observations,
        allergen_statement=parsed_data.allergen_statement,
        missing_info=parsed_data.missing_info,
        caveats=parsed_data.caveats,
        validation=ValidationMeta(
            passed=True,
            retried=was_retried,
        ),
    )

    # 9. Store in explanation cache
    explanation_cache.set(cache_key, response)
    return response
