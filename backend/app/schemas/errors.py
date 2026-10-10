"""Error response schemas (for documentation)."""

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    """Individual error detail."""

    code: str
    message: str
    request_id: str


class ErrorResponse(BaseModel):
    """Standard error envelope."""

    error: ErrorDetail
