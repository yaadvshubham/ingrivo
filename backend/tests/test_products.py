import pytest
import json
from pathlib import Path
from unittest.mock import patch
from app.main import app
from app.schemas.product import NutritionBasis, Provenance
from app.core.cache import product_cache
from app.core.rate_limit import outbound_limiter, inbound_limiter
from app.services.barcode import is_valid_barcode, normalize_barcode
from httpx import AsyncClient, ASGITransport

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "off"

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.fixture
async def client():
    # Reset cache and rate limiters before each test
    product_cache.cache.clear()
    outbound_limiter.history.clear()
    inbound_limiter.history.clear()
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

def load_fixture(name: str) -> dict:
    with open(FIXTURES_DIR / f"{name}.json", "r", encoding="utf-8") as f:
        return json.load(f)

# Table-driven barcode unit tests
@pytest.mark.parametrize(
    "code,expected_valid,expected_normalized",
    [
        # Valid EAN-13
        ("5449000000996", True, "5449000000996"),
        ("3017620422003", True, "3017620422003"),
        ("8000500003787", True, "8000500003787"),
        # Valid UPC-A (12 digits, normalized to 13 with leading zero)
        ("012345678905", True, "0012345678905"),
        ("737628064502", True, "0737628064502"),
        # Valid EAN-8
        ("40123455", True, "40123455"),
        ("55123457", True, "55123457"),
        # Leading zeros matter (preserved as strings)
        ("0000000000000", True, "0000000000000"),
        # Whitespace handling
        (" 5449000000996 ", True, "5449000000996"),
        # Bad check digit
        ("5449000000997", False, "5449000000997"),
        ("012345678900", False, "0012345678900"),
        # Non-digits
        ("544900000099A", False, "544900000099A"),
        ("barcode", False, "barcode"),
        # Wrong length
        ("123", False, "123"),
        ("1234567", False, "1234567"),
        ("123456789", False, "123456789"),
        ("12345678901234", False, "12345678901234"),
    ]
)
def test_barcode_validation_and_normalization(code, expected_valid, expected_normalized):
    assert is_valid_barcode(code) == expected_valid
    if expected_valid:
        assert normalize_barcode(code) == expected_normalized

@pytest.mark.anyio
async def test_invalid_barcode_rejected_immediately(client: AsyncClient):
    response = await client.get("/api/v1/products/barcode/123")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_BARCODE"

@pytest.mark.anyio
@pytest.mark.parametrize(
    "fixture_name",
    [
        "5449000000996",
        "3017620422003",
        "8000500003787",
        "5053990138722",
        "5000159461122",
        "9002490100070",
        "5000157024671",
        "9999999999999",
    ]
)
async def test_all_recorded_fixtures_normalize_without_error(fixture_name):
    from app.services.normalizer import normalize_off_product
    data = load_fixture(fixture_name)
    assert "product" in data
    product = normalize_off_product(data["product"], "v3")
    assert product.ref.startswith("bc-")
    assert product.completeness.score >= 0.0

@pytest.mark.anyio
async def test_normalization_coca_cola(client: AsyncClient):
    fixture_data = load_fixture("5449000000996")
    
    with patch("app.routers.products.fetch_off_product", return_value=fixture_data["product"]):
        response = await client.get("/api/v1/products/barcode/5449000000996")
        
    assert response.status_code == 200
    data = response.json()
    
    assert data["ref"] == "bc-5449000000996"
    assert data["name"] == "Coca-Cola"
    assert data["nutrition"]["basis"] == "per_100g"
    # Ensure missing nutrients stay None, never converted to 0
    assert data["nutrition"]["values"]["fibre"] is None
    # Empty allergens don't become "allergen-free", they are missing provenance with empty lists
    assert data["allergens"]["declared"] == []
    assert data["allergens"]["provenance"] == "missing"

@pytest.mark.anyio
async def test_product_not_found(client: AsyncClient):
    from app.services.off_client import ProductNotFound
    with patch("app.routers.products.fetch_off_product", side_effect=ProductNotFound()):
        response = await client.get("/api/v1/products/barcode/5449000000996")
        
    assert response.status_code == 404
    err = response.json()["error"]
    assert err["code"] == "PRODUCT_NOT_FOUND"
    assert "fallbacks" in err["message"]

@pytest.mark.anyio
async def test_upstream_timeout(client: AsyncClient):
    from app.services.off_client import UpstreamTimeout
    with patch("app.routers.products.fetch_off_product", side_effect=UpstreamTimeout()):
        response = await client.get("/api/v1/products/barcode/5449000000996")
    
    assert response.status_code == 504
    assert response.json()["error"]["code"] == "UPSTREAM_TIMEOUT"

@pytest.mark.anyio
async def test_upstream_rate_limited_429(client: AsyncClient):
    from app.services.off_client import UpstreamRateLimited
    with patch("app.routers.products.fetch_off_product", side_effect=UpstreamRateLimited(60)):
        response = await client.get("/api/v1/products/barcode/5449000000996")
        
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "UPSTREAM_RATE_LIMITED"

@pytest.mark.anyio
async def test_upstream_invalid_response(client: AsyncClient):
    from app.services.off_client import UpstreamInvalidResponse
    with patch("app.routers.products.fetch_off_product", side_effect=UpstreamInvalidResponse("bad json")):
        response = await client.get("/api/v1/products/barcode/5449000000996")
        
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "UPSTREAM_INVALID_RESPONSE"

@pytest.mark.anyio
async def test_cache_hit_avoids_upstream(client: AsyncClient):
    fixture_data = load_fixture("5449000000996")
    from app.services.normalizer import normalize_off_product
    product = normalize_off_product(fixture_data["product"], "v3")
    product_cache.set("5449000000996", product, ttl=100)
    
    with patch("app.routers.products.fetch_off_product") as mock_fetch:
        response = await client.get("/api/v1/products/barcode/5449000000996")
        mock_fetch.assert_not_called()
        
    assert response.status_code == 200
    assert response.json()["ref"] == "bc-5449000000996"

@pytest.mark.anyio
async def test_outbound_rate_limiter_blocks_13th_call(client: AsyncClient):
    import time
    from collections import deque
    now = time.time()
    outbound_limiter.history["outbound_off"] = deque([now] * 12)
    
    response = await client.get("/api/v1/products/barcode/5449000000996")
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "UPSTREAM_RATE_LIMITED"

@pytest.mark.anyio
async def test_unknown_basis_stays_unknown():
    from app.services.normalizer import normalize_off_product
    raw = {
        "code": "12345670",
        "product_name": "Test Item",
        "nutrition_data_per": "unrecognized_basis",
        "nutriments": {"energy-kcal": 100}
    }
    product = normalize_off_product(raw, "v3")
    assert product.nutrition.basis == NutritionBasis.unknown

@pytest.mark.live
@pytest.mark.anyio
async def test_live_off_api(client: AsyncClient):
    """
    Live test against Open Food Facts.
    Must be explicitly invoked with: pytest -m live.
    """
    response = await client.get("/api/v1/products/barcode/5449000000996")
    assert response.status_code == 200
    assert response.json()["name"] == "Coca-Cola"
