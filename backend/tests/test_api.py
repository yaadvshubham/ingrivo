"""Tests for the Pinfo backend API."""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    """Create an async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest.mark.anyio
async def test_health_returns_ok(client: AsyncClient):
    """GET /api/v1/health returns 200 with expected fields."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "environment" in data
    assert "gemini_configured" in data
    assert isinstance(data["gemini_configured"], bool)


@pytest.mark.anyio
async def test_health_never_exposes_api_key(client: AsyncClient, monkeypatch):
    """The health endpoint must NEVER return the Gemini API key."""
    monkeypatch.setenv("GEMINI_API_KEY", "super-secret-key-12345")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.0-flash")

    # Re-import settings to pick up the monkeypatched env vars
    from app.core.config import Settings
    import app.core.config as config_module
    original_settings = config_module.settings
    config_module.settings = Settings()

    try:
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        body_text = response.text
        assert "super-secret-key-12345" not in body_text
        data = response.json()
        # Only gemini_configured (bool) should appear, not the key itself
        assert "GEMINI_API_KEY" not in data
        assert "gemini_api_key" not in data
        for value in data.values():
            assert value != "super-secret-key-12345"
    finally:
        config_module.settings = original_settings


@pytest.mark.anyio
async def test_unknown_route_returns_error_envelope(client: AsyncClient):
    """A 404 response must use the standard error envelope."""
    response = await client.get("/api/v1/nonexistent-route")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert "code" in data["error"]
    assert "message" in data["error"]
    assert "request_id" in data["error"]


@pytest.mark.anyio
async def test_health_has_request_id_header(client: AsyncClient):
    """Every response must include an X-Request-ID header."""
    response = await client.get("/api/v1/health")
    assert "X-Request-ID" in response.headers


@pytest.mark.anyio
async def test_request_id_echoed_back(client: AsyncClient):
    """If the client sends X-Request-ID, the server echoes it back."""
    custom_id = "test-request-id-abc123"
    response = await client.get(
        "/api/v1/health",
        headers={"X-Request-ID": custom_id},
    )
    assert response.headers["X-Request-ID"] == custom_id


@pytest.mark.anyio
async def test_cors_allows_configured_origin(client: AsyncClient):
    """CORS should allow the origin configured in ALLOWED_ORIGINS."""
    response = await client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


@pytest.mark.anyio
async def test_cors_rejects_unconfigured_origin(client: AsyncClient):
    """CORS should not allow an origin not in ALLOWED_ORIGINS."""
    response = await client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://evil-site.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    # The origin should NOT be reflected back
    allow_origin = response.headers.get("access-control-allow-origin")
    assert allow_origin != "http://evil-site.com"


@pytest.mark.anyio
async def test_google_auth_with_email_and_profile(client: AsyncClient):
    """Google auth endpoint creates session with valid email and name."""
    response = await client.post(
        "/api/v1/auth/google",
        json={
            "email": "testuser@gmail.com",
            "name": "Test User",
            "photo_url": "https://lh3.googleusercontent.com/test-photo",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data
    assert data["user"]["email"] == "testuser@gmail.com"
    assert data["user"]["name"] == "Test User"
    assert data["user"]["photo_url"] == "https://lh3.googleusercontent.com/test-photo"


@pytest.mark.anyio
async def test_google_auth_missing_credentials_fails(client: AsyncClient):
    """Google auth without email or token fails gracefully with 400."""
    response = await client.post(
        "/api/v1/auth/google",
        json={"name": "No Email Person"},
    )
    assert response.status_code == 400
