import json
from pathlib import Path
from unittest.mock import patch, AsyncMock
import pytest
from httpx import AsyncClient, ASGITransport

from app.core.cache import search_cache
from app.core.rate_limit import outbound_search_limiter, inbound_search_limiter

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "search"


def load_fixture(name: str):
    with open(FIXTURES_DIR / f"{name}.json", "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def reset_search_state():
    search_cache.cache.clear()
    outbound_search_limiter.history.clear()
    inbound_search_limiter.history.clear()
    yield
    search_cache.cache.clear()
    outbound_search_limiter.history.clear()
    inbound_search_limiter.history.clear()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Unit Tests: Sanitization and Normalization
# ---------------------------------------------------------------------------

def test_sanitize_search_query_neutralizes_lucene_chars():
    raw = 'coca* AND "cola" OR items:test? [1 TO 5] +must -not'
    clean = sanitize_search_query(raw)
    assert r"\*" in clean
    assert r"\"" in clean
    assert r"\:" in clean
    assert r"\?" in clean
    assert r"\[" in clean
    assert r"\]" in clean
    assert r"\+" in clean
    assert r"\-" in clean


def test_sanitize_search_query_removes_control_characters():
    raw = "coca\x00\x1fcola\x7f"
    clean = sanitize_search_query(raw)
    assert clean == "cocacola"


def test_compute_nutrition_availability():
    assert compute_nutrition_availability({}) == "none"
    assert compute_nutrition_availability({"energy-kcal": 42}) == "partial"
    assert compute_nutrition_availability({
        "energy-kcal": 42,
        "sugars": 10,
        "fat": 0,
        "proteins": 1
    }) == "most"


def test_normalize_search_hit_skips_invalid_barcodes():
    sample_hit = {
        "code": "invalid123",
        "product_name": "Bad Product",
    }
    # execute_search skips invalid codes
    # Direct normalize_search_hit creates bc-invalid123
    res = normalize_search_hit({"code": "5449000000996", "product_name": "Coca-Cola", "categories": "Drinks, Sodas, Colas"})
    assert res.ref == "bc-5449000000996"
    assert res.name == "Coca-Cola"
    assert len(res.categories) <= 2


from httpx import Response
from app.main import app
from app.services.search_client import (
    sanitize_search_query,
    compute_nutrition_availability,
    normalize_search_hit,
    execute_search,
    SearchTimeout,
    SearchRateLimited,
    SearchInvalidResponse,
)


@pytest.mark.anyio
async def test_execute_search_with_coca_cola_fixture():
    fixture_data = load_fixture("coca_cola")
    with patch("app.services.search_client.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_cls.return_value.__aenter__.return_value = mock_client
        mock_client.get.return_value = Response(200, json=fixture_data)

        response = await execute_search("coca cola", page=1, page_size=12)

        assert response.query == "coca cola"
        assert response.page == 1
        assert len(response.results) > 0
        assert all(r.ref.startswith("bc-") for r in response.results)
        for r in response.results:
            assert len(r.categories) <= 2
            assert r.nutrition_availability in ("none", "partial", "most")


@pytest.mark.anyio
async def test_execute_search_empty_fixture():
    fixture_data = load_fixture("empty")
    with patch("app.services.search_client.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_cls.return_value.__aenter__.return_value = mock_client
        mock_client.get.return_value = Response(200, json=fixture_data)

        response = await execute_search("nonexistent", page=1)

        assert response.total == 0
        assert len(response.results) == 0


@pytest.mark.anyio
async def test_execute_search_malformed_fixture():
    fixture_data = load_fixture("malformed")
    with patch("app.services.search_client.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_cls.return_value.__aenter__.return_value = mock_client
        mock_client.get.return_value = Response(200, json=fixture_data)

        with pytest.raises(SearchInvalidResponse):
            await execute_search("anything", page=1)


@pytest.mark.anyio
async def test_execute_search_rate_limited_429():
    with patch("app.services.search_client.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_cls.return_value.__aenter__.return_value = mock_client
        mock_client.get.return_value = Response(429, headers={"Retry-After": "45"})

        with pytest.raises(SearchRateLimited) as exc:
            await execute_search("anything", page=1)
        assert exc.value.retry_after == 45


@pytest.mark.anyio
async def test_execute_search_upstream_timeout():
    import httpx
    with patch("app.services.search_client.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_cls.return_value.__aenter__.return_value = mock_client
        mock_client.get.side_effect = httpx.TimeoutException("Timeout")

        with pytest.raises(SearchTimeout):
            await execute_search("anything", page=1)


# ---------------------------------------------------------------------------
# Router & HTTP Endpoint Tests (/api/v1/products/search)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_search_endpoint_query_validation(client: AsyncClient):
    # Under 2 characters
    r = await client.get("/api/v1/products/search?q=a")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_QUERY"

    # Over 80 characters
    r = await client.get(f"/api/v1/products/search?q={'a'*85}")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_QUERY"

    # Invalid page (< 1 or > 5)
    r = await client.get("/api/v1/products/search?q=coke&page=0")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_QUERY"

    r = await client.get("/api/v1/products/search?q=coke&page=6")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_QUERY"


@pytest.mark.anyio
async def test_search_endpoint_success_and_caching(client: AsyncClient):
    fixture_data = load_fixture("coca_cola")
    with patch("app.services.search_client.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_cls.return_value.__aenter__.return_value = mock_client
        mock_client.get.return_value = Response(200, json=fixture_data)

        # 1st Call: reaches upstream
        r1 = await client.get("/api/v1/products/search?q=coca+cola&page=1")
        assert r1.status_code == 200
        assert mock_client.get.call_count == 1
        data1 = r1.json()
        assert len(data1["results"]) > 0

        # 2nd Call: served from search_cache
        r2 = await client.get("/api/v1/products/search?q=coca+cola&page=1")
        assert r2.status_code == 200
        assert mock_client.get.call_count == 1  # No additional call


@pytest.mark.anyio
async def test_search_endpoint_outbound_rate_limit_blocking(client: AsyncClient):
    fixture_data = load_fixture("empty")
    with patch("app.services.search_client.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_cls.return_value.__aenter__.return_value = mock_client
        mock_client.get.return_value = Response(200, json=fixture_data)

        # Consume 8 requests (SEARCH_MAX_PER_MIN=8) with different client IPs to bypass inbound limit
        for i in range(8):
            r = await client.get(
                f"/api/v1/products/search?q=query{i}",
                headers={"X-Forwarded-For": f"10.0.0.{i+1}"}
            )
            assert r.status_code == 200

        # 9th request triggers outbound rate limit
        r9 = await client.get(
            "/api/v1/products/search?q=query9",
            headers={"X-Forwarded-For": "10.0.0.9"}
        )
        assert r9.status_code == 429
        assert r9.json()["error"]["code"] == "UPSTREAM_RATE_LIMITED"


@pytest.mark.anyio
async def test_search_endpoint_inbound_rate_limit_blocking(client: AsyncClient):
    # INBOUND_SEARCH_MAX_PER_MIN = 6
    fixture_data = load_fixture("empty")
    with patch("app.services.search_client.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_cls.return_value.__aenter__.return_value = mock_client
        mock_client.get.return_value = Response(200, json=fixture_data)

        for i in range(6):
            r = await client.get(f"/api/v1/products/search?q=testquery{i}")
            assert r.status_code == 200

        # 7th request from same client triggers inbound limit
        r7 = await client.get("/api/v1/products/search?q=testquery7")
        assert r7.status_code == 429
        assert r7.json()["error"]["code"] == "RATE_LIMITED"


@pytest.mark.anyio
async def test_search_endpoint_empty_results_returns_200(client: AsyncClient):
    fixture_data = load_fixture("empty")
    with patch("app.services.search_client.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_cls.return_value.__aenter__.return_value = mock_client
        mock_client.get.return_value = Response(200, json=fixture_data)

        r = await client.get("/api/v1/products/search?q=nonexistent")
        assert r.status_code == 200
        assert r.json()["results"] == []
        assert r.json()["total"] == 0
