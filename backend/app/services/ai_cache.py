"""In-memory rate limiters, daily quota tracker, and explanation cache.

- Daily calls cap: tracked in memory, resets automatically at UTC midnight or restart.
- Client rate limiter: token bucket per client IP (default 5 calls per 10 minutes).
- Explanation cache: TTL 24 hours, max 100 items, keyed by sha256(evidence + prompt_version + model).
"""

from collections import OrderedDict
from datetime import datetime, timezone
import hashlib
import time
from typing import Any

from app.core.config import settings
from app.core.errors import AppError


class DailyQuotaTracker:
    """Tracks global AI calls made today; resets at UTC midnight."""

    def __init__(self, daily_limit: int):
        self.daily_limit = daily_limit
        self.current_day = datetime.now(timezone.utc).date()
        self.count = 0

    def check_and_increment(self) -> None:
        today = datetime.now(timezone.utc).date()
        if today != self.current_day:
            self.current_day = today
            self.count = 0

        if self.count >= self.daily_limit:
            raise AppError(
                code="AI_UNAVAILABLE",
                message=f"Global daily AI explanation quota of {self.daily_limit} calls reached. Resets at UTC midnight.",
                status_code=503,
                details={"reason": "daily_cap"},
            )
        self.count += 1

    def reset(self) -> None:
        self.count = 0


class ClientRateLimiter:
    """Token-bucket per-client limiter (default: 5 calls / 10 minutes = 600s)."""

    def __init__(self, max_tokens: int = 5, fill_seconds: int = 600):
        self.max_tokens = max_tokens
        self.fill_rate = max_tokens / fill_seconds
        self.buckets: dict[str, tuple[float, float]] = {}  # ip -> (tokens, last_time)

    def check_limit(self, client_ip: str) -> None:
        now = time.monotonic()
        tokens, last_time = self.buckets.get(client_ip, (float(self.max_tokens), now))

        # Add regenerated tokens
        elapsed = now - last_time
        tokens = min(float(self.max_tokens), tokens + elapsed * self.fill_rate)

        if tokens < 1.0:
            raise AppError(
                code="RATE_LIMITED",
                message="AI explanation rate limit reached (5 requests per 10 minutes). Please wait before requesting another explanation.",
                status_code=429,
            )

        self.buckets[client_ip] = (tokens - 1.0, now)

    def reset(self) -> None:
        self.buckets.clear()


class ExplanationCache:
    """In-memory LRU cache with TTL 24 hours (86400s), max 100 entries."""

    def __init__(self, max_size: int = 100, ttl_seconds: int = 86400):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.cache: OrderedDict[str, tuple[float, Any]] = OrderedDict()

    @staticmethod
    def compute_key(evidence_serialized: str, prompt_version: str, model: str) -> str:
        combined = f"{evidence_serialized}:{prompt_version}:{model}"
        return hashlib.sha256(combined.encode("utf-8")).hexdigest()

    def get(self, key: str) -> Any | None:
        if key not in self.cache:
            return None
        timestamp, value = self.cache[key]
        if time.time() - timestamp > self.ttl_seconds:
            del self.cache[key]
            return None
        self.cache.move_to_end(key)
        return value

    def set(self, key: str, value: Any) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        elif len(self.cache) >= self.max_size:
            self.cache.popitem(last=False)
        self.cache[key] = (time.time(), value)

    def clear(self) -> None:
        self.cache.clear()


# Global singletons
daily_quota = DailyQuotaTracker(daily_limit=settings.GEMINI_MAX_CALLS_PER_DAY)
client_limiter = ClientRateLimiter(max_tokens=settings.EXPLAIN_RATE_LIMIT, fill_seconds=600)
explanation_cache = ExplanationCache()
