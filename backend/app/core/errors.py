"""Shared error utilities."""


def error_envelope(code: str, message: str, request_id: str) -> dict:
    """Build the standard error response envelope.

    Shape:
        {
            "error": {
                "code": "...",
                "message": "...",
                "request_id": "..."
            }
        }
    """
    return {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id,
        }
    }
