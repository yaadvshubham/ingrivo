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
    OFF_USER_AGENT: str = "Ingrivo/0.1.0 (https://github.com/ingrivo)"

    # Gemini (optional for Phase 1)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = ""

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
