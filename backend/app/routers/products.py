from fastapi import APIRouter, Request, HTTPException, Depends
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.cache import product_cache, search_cache
from app.core.rate_limit import (
    inbound_limiter,
    outbound_limiter,
    inbound_search_limiter,
    outbound_search_limiter,
    get_client_ip,
)
from app.schemas.product import Product
from app.schemas.search import SearchResponse

from app.services.barcode import is_valid_barcode, normalize_barcode
from app.services.off_client import (
    fetch_off_product,
    ProductNotFound,
    UpstreamTimeout,
    UpstreamRateLimited,
    UpstreamInvalidResponse,
)
from app.services.normalizer import normalize_off_product
from app.services.search_client import (
    execute_search,
    SearchTimeout,
    SearchRateLimited,
    SearchInvalidResponse,
)

router = APIRouter(prefix="/api/v1/products", tags=["products"])


@router.get("/search", response_model=SearchResponse)
async def search_products(request: Request, q: str = "", page: int = 1):
    # 1. Query parameter validation
    raw_query = q.strip()
    if len(raw_query) < 2 or len(raw_query) > 80:
        raise HTTPException(
            status_code=400,
            detail="INVALID_QUERY:Search query must be between 2 and 80 characters.",
        )

    if page < 1 or page > 5:
        raise HTTPException(
            status_code=400,
            detail="INVALID_QUERY:Page must be between 1 and 5.",
        )

    # 2. Inbound Rate Limiting for search
    client_ip = get_client_ip(request)
    if not inbound_search_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=429,
            detail="RATE_LIMITED:Too many search requests. Please wait a moment and try again.",
        )

    # 3. Cache lookup (key: normalized query + page)
    cache_key = f"search:{raw_query.lower()}:p{page}"
    cached_result = search_cache.get(cache_key)
    if cached_result:
        return cached_result

    # 4. Outbound Rate Limiting for search
    if not outbound_search_limiter.is_allowed("outbound_search"):
        raise HTTPException(
            status_code=429,
            detail="UPSTREAM_RATE_LIMITED:Search service rate limit reached. Try again in a moment.",
        )

    # 5. Execute search
    try:
        search_res = await execute_search(query=raw_query, page=page, page_size=12)
        # Cache results for 1 hour (3600 seconds)
        search_cache.set(cache_key, search_res, ttl=3600)
        return search_res
    except SearchTimeout:
        raise HTTPException(
            status_code=504,
            detail="UPSTREAM_TIMEOUT:Search service request timed out.",
        )
    except SearchRateLimited as e:
        raise HTTPException(
            status_code=503,
            detail=f"UPSTREAM_RATE_LIMITED:{str(e)}",
        )
    except SearchInvalidResponse as e:
        raise HTTPException(
            status_code=502,
            detail=f"UPSTREAM_INVALID_RESPONSE:{str(e)}",
        )


@router.get("/barcode/{code}", response_model=Product)
async def get_product_by_barcode(request: Request, code: str):
    # 1. Inbound Rate Limiting
    client_ip = get_client_ip(request)
    if not inbound_limiter.is_allowed(client_ip):
        # We raise HTTPException so the error handler wraps it in envelope
        raise HTTPException(
            status_code=429,
            detail="RATE_LIMITED:Too many requests. Please try again later."
        )

    # 2. Validation
    if not is_valid_barcode(code):
        # Custom parsing for error handler
        raise HTTPException(
            status_code=400,
            detail="INVALID_BARCODE:The provided barcode is invalid."
        )

    code = normalize_barcode(code)

    # 3. Cache lookup
    cached_product = product_cache.get(code)
    if cached_product == "NOT_FOUND":
        raise HTTPException(
            status_code=404,
            detail='PRODUCT_NOT_FOUND:Product not found. Fallbacks available. {"fallbacks": ["label_scan", "manual_search"]}'
        )
    elif cached_product:
        return cached_product

    # 4. Outbound Rate Limiting
    if not outbound_limiter.is_allowed("outbound_off"):
        raise HTTPException(
            status_code=429,
            detail="UPSTREAM_RATE_LIMITED:Open Food Facts rate limit reached. Try again later."
        )

    # 5. Fetch and Normalize
    try:
        raw_data = await fetch_off_product(code)
        product = normalize_off_product(raw_data, api_version=settings.OFF_API_VERSION)
        
        # Cache found product for 24h
        product_cache.set(code, product, ttl=86400)
        return product
        
    except ProductNotFound:
        # Cache missing product for 5 min
        product_cache.set(code, "NOT_FOUND", ttl=300)
        raise HTTPException(
            status_code=404,
            detail='PRODUCT_NOT_FOUND:Product not found. Fallbacks available. {"fallbacks": ["label_scan", "manual_search"]}'
        )
    except UpstreamTimeout:
        raise HTTPException(
            status_code=504,
            detail="UPSTREAM_TIMEOUT:Timeout while contacting Open Food Facts."
        )
    except UpstreamRateLimited as e:
        raise HTTPException(
            status_code=503,
            detail=f"UPSTREAM_RATE_LIMITED:{str(e)}"
        )
    except UpstreamInvalidResponse as e:
        raise HTTPException(
            status_code=502,
            detail=f"UPSTREAM_INVALID_RESPONSE:{str(e)}"
        )
