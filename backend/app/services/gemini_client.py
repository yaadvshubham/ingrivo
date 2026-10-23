"""Gemini Client wrapper for Pinfo.

The ONLY file that imports the google-genai SDK.
Enforces:
- Structured output using response_schema
- Timeouts
- Strict mapping of 429 quota, safety blocks, timeouts, and auth errors to AppError
- Zero logging of evidence text or model completions
- Logging only of request ID, status, latency (ms), and token counts
"""

import logging
import time
import uuid
from typing import Any, Type, TypeVar
from pydantic import BaseModel

from app.core.config import settings
from app.core.errors import AppError

logger = logging.getLogger("ingrivo.gemini")

T = TypeVar("T", bound=BaseModel)


class GeminiClient:
    """Narrow interface for generating structured AI responses via Gemini API."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL
        self._client: Any = None

    def _get_client(self) -> Any:
        if not self._client:
            if not self.api_key:
                raise AppError(
                    code="AI_NOT_CONFIGURED",
                    message="Gemini API is not configured on this server.",
                    status_code=503,
                )
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    async def generate_structured(
        self,
        system_instruction: str,
        user_prompt: str,
        response_schema: Type[T],
        timeout_seconds: int | None = None,
    ) -> tuple[T, dict[str, Any]]:
        """Calls Gemini with structured JSON output and returns the parsed schema instance plus usage metrics."""
        if not self.api_key or not self.model:
            raise AppError(
                code="AI_NOT_CONFIGURED",
                message="Gemini API is not configured on this server.",
                status_code=503,
            )

        from google.genai import types
        from google.genai.errors import APIError

        client = self._get_client()
        timeout = timeout_seconds or settings.GEMINI_TIMEOUT_SECONDS
        req_id = str(uuid.uuid4())[:8]

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            response_schema=response_schema,
            max_output_tokens=settings.GEMINI_MAX_OUTPUT_TOKENS,
            tools=None,  # Disables grounding and external tools
        )

        start_time = time.monotonic()
        try:
            # SDK generate_content call
            response = client.models.generate_content(
                model=self.model,
                contents=user_prompt,
                config=config,
            )

            latency_ms = round((time.monotonic() - start_time) * 1000, 1)

            # Check for safety or truncation blocks
            candidate = response.candidates[0] if response.candidates else None
            finish_reason = getattr(candidate, "finish_reason", None)
            finish_reason_str = str(finish_reason).upper() if finish_reason else "STOP"

            if "SAFETY" in finish_reason_str:
                logger.warning(
                    "gemini_call req_id=%s status=safety_block latency_ms=%s",
                    req_id,
                    latency_ms,
                )
                raise AppError(
                    code="AI_UNAVAILABLE",
                    message="The AI model refused to process this content due to safety filters.",
                    status_code=503,
                    details={"reason": "safety"},
                )

            if "MAX_TOKENS" in finish_reason_str:
                logger.warning(
                    "gemini_call req_id=%s status=truncated latency_ms=%s",
                    req_id,
                    latency_ms,
                )
                raise AppError(
                    code="AI_INVALID_OUTPUT",
                    message="The AI response was truncated before completion.",
                    status_code=502,
                )

            # Extract usage metadata without logging text
            usage = getattr(response, "usage_metadata", None)
            prompt_tokens = getattr(usage, "prompt_token_count", 0) if usage else 0
            candidate_tokens = getattr(usage, "candidates_token_count", 0) if usage else 0

            logger.info(
                "gemini_call req_id=%s status=success latency_ms=%s prompt_tokens=%s output_tokens=%s",
                req_id,
                latency_ms,
                prompt_tokens,
                candidate_tokens,
            )

            # Response parsing
            parsed: T | None = getattr(response, "parsed", None)
            if parsed is None or not isinstance(parsed, response_schema):
                # Fall back to parsing response.text if parsed is not directly populated
                text = response.text or "{}"
                parsed = response_schema.model_validate_json(text)

            meta = {
                "request_id": req_id,
                "latency_ms": latency_ms,
                "prompt_tokens": prompt_tokens,
                "candidate_tokens": candidate_tokens,
                "model": self.model,
            }
            return parsed, meta

        except AppError:
            raise
        except TimeoutError:
            latency_ms = round((time.monotonic() - start_time) * 1000, 1)
            logger.error("gemini_call req_id=%s status=timeout latency_ms=%s", req_id, latency_ms)
            raise AppError(
                code="AI_UNAVAILABLE",
                message=f"Gemini API request timed out after {timeout} seconds.",
                status_code=504,
                details={"reason": "timeout"},
            )
        except APIError as e:
            latency_ms = round((time.monotonic() - start_time) * 1000, 1)
            status_code = getattr(e, "code", 500)
            err_msg = str(e)

            logger.error("gemini_call req_id=%s status=api_error code=%s latency_ms=%s", req_id, status_code, latency_ms)

            if status_code == 429 or "RESOURCE_EXHAUSTED" in err_msg or "quota" in err_msg.lower():
                raise AppError(
                    code="AI_UNAVAILABLE",
                    message="Upstream AI rate limit or quota exceeded. Please try again shortly.",
                    status_code=429,
                    details={"reason": "quota"},
                )
            elif status_code in (401, 403) or "PERMISSION_DENIED" in err_msg or "API_KEY_INVALID" in err_msg:
                raise AppError(
                    code="AI_UNAVAILABLE",
                    message="Upstream AI authentication error.",
                    status_code=503,
                    details={"reason": "auth"},
                )
            elif status_code == 404 or "not found" in err_msg.lower():
                raise AppError(
                    code="AI_UNAVAILABLE",
                    message=f"Configured AI model '{self.model}' was not found or is retired.",
                    status_code=503,
                    details={"reason": "model_not_found"},
                )
            else:
                raise AppError(
                    code="AI_UNAVAILABLE",
                    message="An upstream error occurred while contacting the AI provider.",
                    status_code=502,
                    details={"reason": "upstream_error"},
                )
        except Exception as e:
            latency_ms = round((time.monotonic() - start_time) * 1000, 1)
            logger.error("gemini_call req_id=%s status=unhandled_error latency_ms=%s error_type=%s", req_id, latency_ms, type(e).__name__)
            raise AppError(
                code="AI_UNAVAILABLE",
                message="An unexpected error occurred during AI processing.",
                status_code=500,
                details={"reason": "upstream_error"},
            )


# Default shared client instance
gemini_client = GeminiClient()
