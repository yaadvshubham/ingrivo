"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings

APP_VERSION = "0.1.0"


class Settings(BaseSettings):
    """All settings loaded from environment variables.

    Secrets (like GEMINI_API_KEY) are never exposed in responses or logs.
    """

    # General
    APP_ENV: str = "development"
    ALLOWED_ORIGINS: str = "https://trypinfo.vercel.app,https://ingrivo.vercel.app,http://localhost:3000"
    DOCS_ENABLED: bool | None = None
    MAX_REQUEST_BODY_BYTES: int = 1_048_576  # 1 MB default limit for request bodies

    # Open Food Facts
    OFF_BASE_URL: str = "https://world.openfoodfacts.org"
    OFF_USER_AGENT: str = "Pinfo/0.1.0"
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
    GEMINI_MAX_CALLS_PER_DAY: int = 2000
    EXPLAIN_RATE_LIMIT: int = 60
    MAX_EVIDENCE_CHARS: int = 4000

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list, safely handling trailing slashes."""
        origins: list[str] = []
        for origin in self.ALLOWED_ORIGINS.split(","):
            cleaned = origin.strip()
            if cleaned:
                origins.append(cleaned)
                trimmed = cleaned.rstrip("/")
                if trimmed and trimmed not in origins:
                    origins.append(trimmed)
        return origins

    @property
    def is_docs_enabled(self) -> bool:
        """Control FastAPI interactive documentation visibility.
        
        Defaults to False when APP_ENV is production, True otherwise.
        Explicitly overridden if DOCS_ENABLED is set.
        """
        if self.DOCS_ENABLED is not None:
            return self.DOCS_ENABLED
        return self.APP_ENV.lower() != "production"

    # SMTP Settings for real OTP and password reset emails
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "Pinfo Food Intelligence"
    SMTP_USE_SSL: bool = False

    # Firebase Admin & JWT Settings
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_CREDENTIALS_PATH: str = ""
    JWT_SECRET_KEY: str = "ingrivo-secret-jwt-key-development-2026-safe-auth"

    # Google OAuth 2.0 Settings
    GOOGLE_CLIENT_ID: str = "812544756607-rmvt2fd0evqh5qeh99rkaji6d9t5rurh.apps.googleusercontent.com"
    GOOGLE_CLIENT_SECRET: str = ""

    @property
    def smtp_configured(self) -> bool:
        """Check if SMTP credentials are configured for sending real emails."""
        return bool(self.SMTP_HOST and self.SMTP_USER and self.SMTP_PASSWORD)

    @property
    def firebase_admin_configured(self) -> bool:
        """Check if Firebase Admin SDK is configured."""
        return bool(self.FIREBASE_PROJECT_ID or self.FIREBASE_CREDENTIALS_PATH)

    @property
    def gemini_configured(self) -> bool:
        """Check if Gemini API key and model are both set."""
        return bool(self.GEMINI_API_KEY and self.GEMINI_MODEL)

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
