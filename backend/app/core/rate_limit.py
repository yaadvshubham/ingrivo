import time
from collections import deque
from fastapi import Request
from app.core.config import settings

class RateLimiter:
    """
    A simple sliding window rate limiter.
    """
    def __init__(self, max_requests: int, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # Dict of client_id -> deque of timestamps
        self.history = {}

    def is_allowed(self, client_id: str) -> bool:
        now = time.time()
        
        if client_id not in self.history:
            self.history[client_id] = deque()
            
        timestamps = self.history[client_id]
        
        # Remove timestamps outside the window
        while timestamps and timestamps[0] <= now - self.window_seconds:
            timestamps.popleft()
            
        if len(timestamps) >= self.max_requests:
            return False
            
        timestamps.append(now)
        return True

# Outbound limiter protecting Open Food Facts
# Configured via env var, default 12
outbound_limiter = RateLimiter(max_requests=getattr(settings, "OFF_MAX_REQUESTS_PER_MIN", 12), window_seconds=60)

# Inbound limiter protecting our API
# Configured via env var, default 20
inbound_limiter = RateLimiter(max_requests=getattr(settings, "INBOUND_MAX_REQUESTS_PER_MIN", 20), window_seconds=60)

# Phase 5: Search Limiters
outbound_search_limiter = RateLimiter(max_requests=getattr(settings, "SEARCH_MAX_PER_MIN", 8), window_seconds=60)
inbound_search_limiter = RateLimiter(max_requests=getattr(settings, "INBOUND_SEARCH_MAX_PER_MIN", 6), window_seconds=60)

def get_client_ip(request: Request) -> str:
    """
    Safely extract client IP behind Render's proxy.
    Render populates X-Forwarded-For. If missing, fallback to request.client.host.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # X-Forwarded-For can contain a comma-separated list of IPs.
        # The first IP is the original client.
        return forwarded.split(",")[0].strip()
    
    if request.client and request.client.host:
        return request.client.host
        
    return "127.0.0.1"
