import re
from typing import Dict, Any, List
import httpx
import logging

from app.core.config import settings
from app.schemas.search import ProductSummary, SearchResponse
from app.services.barcode import is_valid_barcode, normalize_barcode

logger = logging.getLogger("ingrivo.search_client")

# Lucene special characters: + - && || ! ( ) { } [ ] ^ " ~ * ? : \ /
LUCENE_SPECIAL_CHARS = re.compile(r'([\+\-\&\|\!\(\)\{\}\[\]\^\"~*\?:\\\/])')


def sanitize_search_query(raw_query: str) -> str:
    """
    Sanitizes user input:
    - Strips whitespace
    - Removes control characters
    - Neutralizes Lucene syntax by backslash-escaping special characters
    """
    if not raw_query:
        return ""
    # Strip control chars
    clean = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', raw_query).strip()
    # Escape Lucene operators
    clean = LUCENE_SPECIAL_CHARS.sub(r'\\\1', clean)
    return clean


def compute_nutrition_availability(nutriments: Dict[str, Any]) -> str:
    """
    Classifies nutrition availability:
    - 'most': at least 4 key nutrients present
    - 'partial': 1 to 3 key nutrients present
    - 'none': 0 key nutrients present
    Key nutrients evaluated: energy, sugars, fat, saturated_fat, proteins, salt/sodium, carbohydrates.
    """
    if not isinstance(nutriments, dict):
        return "none"

    keys = [
        "energy-kcal", "energy-kcal_100g", "energy-kcal_value", "energy_100g",
        "sugars", "sugars_100g", "sugars_value",
        "fat", "fat_100g", "fat_value",
        "saturated-fat", "saturated-fat_100g",
        "proteins", "proteins_100g", "protein",
        "carbohydrates", "carbohydrates_100g",
        "salt", "salt_100g", "sodium", "sodium_100g"
    ]

    present_count = 0
    checked_groups = [
        ["energy-kcal", "energy-kcal_100g", "energy-kcal_value", "energy_100g"],
        ["sugars", "sugars_100g", "sugars_value"],
        ["fat", "fat_100g", "fat_value"],
        ["saturated-fat", "saturated-fat_100g"],
        ["proteins", "proteins_100g", "protein"],
        ["carbohydrates", "carbohydrates_100g"],
        ["salt", "salt_100g", "sodium", "sodium_100g"],
    ]

    for group in checked_groups:
        if any(nutriments.get(k) is not None for k in group):
            present_count += 1

    if present_count >= 4:
        return "most"
    elif present_count >= 1:
        return "partial"
    return "none"


def normalize_search_hit(hit: Dict[str, Any]) -> ProductSummary:
    """
    Transforms a raw Search-a-licious hit into a ProductSummary.
    Filters categories to at most 2 items.
    """
    raw_code = str(hit.get("code", "")).strip()
    norm_code = normalize_barcode(raw_code)

    # Categories: take up to 2
    raw_cats = hit.get("categories", "")
    categories: List[str] = []
    if isinstance(raw_cats, str) and raw_cats:
        categories = [c.strip() for c in raw_cats.split(",") if c.strip()][:2]
    elif isinstance(raw_cats, list):
        categories = [str(c).strip() for c in raw_cats if str(c).strip()][:2]

    # Ingredients availability
    ing_text = hit.get("ingredients_text") or hit.get("ingredients_text_en")
    has_ing = bool(ing_text and str(ing_text).strip())

    # Image URL
    image_url = hit.get("image_front_url") or hit.get("image_url") or None

    nutriments = hit.get("nutriments") or {}
    nutr_avail = compute_nutrition_availability(nutriments)

    # Brand handling (can be string or list of strings in Search-a-licious)
    raw_brand = hit.get("brands")
    brand: Optional[str] = None
    if isinstance(raw_brand, list):
        brand = ", ".join(str(b).strip() for b in raw_brand if str(b).strip()) or None
    elif isinstance(raw_brand, str) and raw_brand.strip():
        brand = raw_brand.strip()

    return ProductSummary(
        ref=f"bc-{norm_code}",
        name=hit.get("product_name") or None,
        brand=brand,
        image_url=image_url,
        categories=categories,
        has_ingredients=has_ing,
        nutrition_availability=nutr_avail,
        source="Open Food Facts",
    )


class SearchTimeout(Exception):
    pass


class SearchRateLimited(Exception):
    def __init__(self, retry_after: int = 60):
        self.retry_after = retry_after
        super().__init__(f"Search rate limited. Retry after {retry_after}s.")


class SearchInvalidResponse(Exception):
    pass


async def execute_search(query: str, page: int = 1, page_size: int = 12) -> SearchResponse:
    """
    Executes a single search request against Search-a-licious.
    No loops, no retry storms.
    """
    clean_query = sanitize_search_query(query)
    fields = "code,product_name,brands,image_front_url,image_url,categories,ingredients_text,ingredients_text_en,nutriments"

    url = f"{settings.SEARCH_BASE_URL}/search"
    params = {
        "q": clean_query,
        "page": page,
        "page_size": page_size,
        "fields": fields,
    }
    headers = {
        "User-Agent": settings.OFF_USER_AGENT
    }
    timeout = httpx.Timeout(10.0, connect=3.0, read=8.0, write=5.0, pool=5.0)

    async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
        try:
            response = await client.get(url, params=params)
        except httpx.TimeoutException:
            raise SearchTimeout()
        except httpx.RequestError as req_err:
            logger.error(f"Search upstream request error: {req_err}")
            raise SearchInvalidResponse(f"Search request failed: {req_err}")

        if response.status_code in (429, 503):
            retry_after = int(response.headers.get("Retry-After", 60))
            raise SearchRateLimited(retry_after=retry_after)
        elif response.status_code != 200:
            logger.error(f"Search HTTP error {response.status_code}: {response.text}")
            raise SearchInvalidResponse(f"Unexpected search status: {response.status_code}")

        try:
            data = response.json()
        except ValueError:
            raise SearchInvalidResponse("Invalid JSON from search upstream")

        if not isinstance(data, dict) or "hits" not in data or not isinstance(data["hits"], list):
            raise SearchInvalidResponse("Malformed search upstream response structure")

        # Map hits to ProductSummary, skipping hits without a valid barcode
        results: List[ProductSummary] = []
        for hit in data["hits"]:
            if not isinstance(hit, dict):
                continue
            code_str = str(hit.get("code", "")).strip()
            if not code_str or not is_valid_barcode(code_str):
                continue
            results.append(normalize_search_hit(hit))

        total_count = data.get("count")
        page_count = data.get("page_count", 1 if results else 0)

        return SearchResponse(
            query=query,
            page=page,
            page_size=page_size,
            total=total_count,
            page_count=page_count,
            results=results,
        )
