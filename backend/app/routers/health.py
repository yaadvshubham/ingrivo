"""Health check router."""

from fastapi import APIRouter

from app.core.config import settings, APP_VERSION

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
async def health_check():
    """Return application health status.

    Never exposes secret values like GEMINI_API_KEY.
    Only reports whether Gemini is configured (true/false).
    """
    return {
        "status": "ok",
        "version": APP_VERSION,
        "environment": settings.APP_ENV,
        "gemini_configured": settings.gemini_configured,
    }
