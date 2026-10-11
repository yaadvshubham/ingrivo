class AppError(Exception):
    """Application-level typed error that maps cleanly to HTTP JSON error envelopes."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: dict | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def error_envelope(code: str, message: str, request_id: str, details: dict | None = None) -> dict:
    """Build the standard error response envelope."""
    payload: dict = {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id,
        }
    }
    if details:
        payload["error"]["details"] = details
    return payload
