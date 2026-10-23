"""Security, headers, request size, and robustness tests for Pinfo API."""

import pytest
import logging
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI
from app.main import app
from app.core.config import Settings
import app.core.config as config_module


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest.mark.anyio
async def test_security_headers_on_responses(client: AsyncClient):
    """Responses must include X-Content-Type-Options and Referrer-Policy."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


@pytest.mark.anyio
async def test_error_response_cache_control(client: AsyncClient):
    """Error responses must include Cache-Control no-store headers."""
    response = await client.get("/api/v1/nonexistent-endpoint")
    assert response.status_code == 404
    cache_control = response.headers.get("cache-control", "")
    assert "no-store" in cache_control


@pytest.mark.anyio
async def test_request_size_limit_rejects_oversized_post(client: AsyncClient):
    """POST request with body length exceeding MAX_REQUEST_BODY_BYTES returns 413."""
    oversized_length = config_module.settings.MAX_REQUEST_BODY_BYTES + 1024
    response = await client.post(
        "/api/v1/compare",
        content=b"x",
        headers={
            "content-length": str(oversized_length),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 413
    data = response.json()
    assert data["error"]["code"] == "PAYLOAD_TOO_LARGE"
    assert "exceeds the maximum allowed limit" in data["error"]["message"]


@pytest.mark.anyio
async def test_cors_never_wildcard(client: AsyncClient):
    """CORS response must never use wildcard '*'."""
    response = await client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://untrusted-site.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    origin_header = response.headers.get("access-control-allow-origin")
    assert origin_header != "*"
    assert origin_header != "http://untrusted-site.com"


@pytest.mark.anyio
async def test_stack_traces_never_reach_client():
    """Unhandled exceptions must return 500 without leaking stack traces or internal details."""
    import json
    from starlette.requests import Request
    from app.main import unhandled_exception_handler

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/health",
        "headers": [],
    }
    req = Request(scope)
    req.state.request_id = "test-unhandled-err-id"
    exc = RuntimeError("SecretDatabaseCrash: Traceback in line 9999 /sensitive/path")

    response = await unhandled_exception_handler(req, exc)
    assert response.status_code == 500
    data = json.loads(response.body.decode())
    assert data["error"]["code"] == "INTERNAL_ERROR"
    assert data["error"]["message"] == "An unexpected error occurred."
    assert data["error"]["request_id"] == "test-unhandled-err-id"
    # Ensure no internal path or traceback leaked
    body_text = response.body.decode()
    assert "SecretDatabaseCrash" not in body_text
    assert "sensitive/path" not in body_text
    assert "Traceback" not in body_text


@pytest.mark.anyio
async def test_docs_disabled_in_production(monkeypatch):
    """FastAPI interactive docs must default to OFF when APP_ENV is production."""
    prod_settings = Settings(APP_ENV="production")
    assert prod_settings.is_docs_enabled is False

    # Overridden by explicit DOCS_ENABLED=True
    prod_with_docs = Settings(APP_ENV="production", DOCS_ENABLED=True)
    assert prod_with_docs.is_docs_enabled is True

    # Dev defaults to True
    dev_settings = Settings(APP_ENV="development")
    assert dev_settings.is_docs_enabled is True


@pytest.mark.anyio
async def test_no_secrets_or_evidence_in_logs(client: AsyncClient, caplog):
    """Backend logs must never log evidence text, GEMINI_API_KEY, or private payloads."""
    caplog.set_level(logging.INFO, logger="ingrivo")

    # Send a request with a custom header
    await client.get(
        "/api/v1/health",
        headers={"Authorization": "Bearer super-secret-token-xyz"},
    )

    all_logs = " ".join([record.getMessage() for record in caplog.records])
    assert "super-secret-token-xyz" not in all_logs
    assert "Bearer" not in all_logs
