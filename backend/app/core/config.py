"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings

APP_VERSION = "0.1.0"


class Settings(BaseSettings):
    """All settings loaded from environment variables.

    Secrets (like GEMINI_API_KEY) are never exposed in responses or logs.
    """

    # General
    APP_ENV: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Open Food Facts
    OFF_BASE_URL: str = "https://world.openfoodfacts.org"
    OFF_USER_AGENT: str = "Ingrivo/0.1.0"
    OFF_API_VERSION: str = "v3"
    OFF_STAGING_BASIC_AUTH: str = ""
    OFF_MAX_REQUESTS_PER_MIN: int = 12
    INBOUND_MAX_REQUESTS_PER_MIN: int = 20

    # Search (Phase 5: Search-a-licious)
    SEARCH_BASE_URL: str = "https://search.openfoodfacts.org"
    SEARCH_MAX_PER_MIN: int = 8
    INBOUND_SEARCH_MAX_PER_MIN: int = 6

    # Gemini Configuration & Cost / Rate Limits (Phase 7)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_TIMEOUT_SECONDS: int = 20
    GEMINI_MAX_OUTPUT_TOKENS: int = 1500
    GEMINI_MAX_CALLS_PER_DAY: int = 100
    EXPLAIN_RATE_LIMIT: int = 5
    MAX_EVIDENCE_CHARS: int = 4000

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def gemini_configured(self) -> bool:
        """Check if Gemini API key and model are both set."""
        return bool(self.GEMINI_API_KEY and self.GEMINI_MODEL)

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
