import time
from typing import Dict, Any, Optional
from collections import OrderedDict

class TTLCache:
    """
    In-memory TTL Cache with a maximum size (LRU eviction).
    Found products are cached longer than missing products.
    Errors are never cached.
    Note: On Render Free Tier, this cache will reset every time the server restarts or scales.
    """
    def __init__(self, maxsize: int = 1000):
        self.cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self.maxsize = maxsize

    def get(self, key: str) -> Optional[Any]:
        if key not in self.cache:
            return None
        
        entry = self.cache[key]
        if time.time() > entry['expiry']:
            # Expired
            self.pop(key)
            return None
            
        # Move to end to show it was recently used
        self.cache.move_to_end(key)
        return entry['value']

    def set(self, key: str, value: Any, ttl: int) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        
        self.cache[key] = {
            'value': value,
            'expiry': time.time() + ttl
        }
        
        # Enforce maxsize
        if len(self.cache) > self.maxsize:
            # Pop the oldest item (first in OrderedDict)
            self.cache.popitem(last=False)

    def pop(self, key: str) -> None:
        if key in self.cache:
            del self.cache[key]

# Singleton instances
product_cache = TTLCache(maxsize=1000)
search_cache = TTLCache(maxsize=500)
