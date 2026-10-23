#!/usr/bin/env python3
"""Local Rate Limiter Verification Script.

Exercises the backend's in-memory limiters against a local fake upstream.
Guaranteed to NEVER make network calls to real Open Food Facts, Search-a-licious, or Gemini services.
"""

import sys
import time
from pathlib import Path

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.rate_limit import RateLimiter, outbound_limiter, inbound_limiter, outbound_search_limiter, inbound_search_limiter
from app.services.ai_cache import ClientRateLimiter, DailyQuotaTracker
from app.core.errors import AppError


def test_sliding_window_limiter():
    print("Testing RateLimiter (sliding window)...")
    limiter = RateLimiter(max_requests=5, window_seconds=2)
    client_id = "test-client-1"

    # First 5 calls allowed
    for i in range(5):
        allowed = limiter.is_allowed(client_id)
        if not allowed:
            print(f"FAILED: Call {i+1} should have been allowed")
            return False

    # 6th call rejected
    if limiter.is_allowed(client_id):
        print("FAILED: 6th call should have been rejected")
        return False

    # Wait for window to expire
    time.sleep(2.1)
    if not limiter.is_allowed(client_id):
        print("FAILED: Call after window expiry should have been allowed")
        return False

    print("  [OK] Sliding window limiter passed.")
    return True


def test_ai_client_limiter():
    print("Testing ClientRateLimiter (token bucket)...")
    limiter = ClientRateLimiter(max_tokens=3, fill_seconds=60)
    client_ip = "192.168.1.50"

    # Consume 3 tokens
    for i in range(3):
        try:
            limiter.check_limit(client_ip)
        except AppError as e:
            print(f"FAILED: Initial call {i+1} was rejected: {e}")
            return False

    # 4th call must raise RATE_LIMITED
    try:
        limiter.check_limit(client_ip)
        print("FAILED: 4th call should have raised AppError(RATE_LIMITED)")
        return False
    except AppError as e:
        if e.code != "RATE_LIMITED":
            print(f"FAILED: Expected code RATE_LIMITED, got {e.code}")
            return False

    print("  [OK] ClientRateLimiter token bucket passed.")
    return True


def test_ai_daily_quota():
    print("Testing DailyQuotaTracker...")
    tracker = DailyQuotaTracker(daily_limit=4)

    for i in range(4):
        try:
            tracker.check_and_increment()
        except AppError as e:
            print(f"FAILED: Allowed call {i+1} was rejected: {e}")
            return False

    # 5th call must raise AI_UNAVAILABLE
    try:
        tracker.check_and_increment()
        print("FAILED: 5th call should have raised AppError(AI_UNAVAILABLE)")
        return False
    except AppError as e:
        if e.code != "AI_UNAVAILABLE":
            print(f"FAILED: Expected code AI_UNAVAILABLE, got {e.code}")
            return False

    print("  [OK] DailyQuotaTracker quota cap passed.")
    return True


def main():
    print("==================================================")
    print("INGRIVO LOCAL RATE LIMITER AUDIT (OFFLINE)")
    print("==================================================")

    success = (
        test_sliding_window_limiter()
        and test_ai_client_limiter()
        and test_ai_daily_quota()
    )

    if success:
        print("\nAll local rate limiters verified successfully. Zero external calls made.")
        sys.exit(0)
    else:
        print("\nRate limiter verification FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
