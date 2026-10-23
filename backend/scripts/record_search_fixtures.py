#!/usr/bin/env python3
"""
backend/scripts/record_search_fixtures.py

Calls search.openfoodfacts.org once for each query in docs/test-queries.txt,
with at least 8 seconds between calls.
Saves raw JSON responses to backend/tests/fixtures/search/<query_slug>.json,
plus an empty-result fixture and a malformed fixture.
"""

import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path
import httpx

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
FIXTURES_DIR = BACKEND_DIR / "tests" / "fixtures" / "search"
QUERIES_FILE = REPO_ROOT / "docs" / "test-queries.txt"

SEARCH_BASE_URL = "https://search.openfoodfacts.org"
USER_AGENT = "Pinfo/0.1.0 (yaadv@example.com)"
FIELDS = "code,product_name,brands,image_front_url,categories,ingredients_text,nutriments"


def slugify(text: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "_", slug)


async def record_fixtures():
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    with open(QUERIES_FILE, "r", encoding="utf-8") as f:
        queries = [l.strip() for l in f if l.strip() and not l.startswith("#")]

    print(f"Loaded {len(queries)} test queries from {QUERIES_FILE}")
    print(f"Saving fixtures to {FIXTURES_DIR}")

    headers = {"User-Agent": USER_AGENT}
    timeout = httpx.Timeout(12.0)

    async with httpx.AsyncClient(headers=headers, timeout=timeout) as client:
        for idx, query in enumerate(queries, start=1):
            print(f"[{idx}/{len(queries)}] Querying: '{query}'...", end=" ", flush=True)
            slug = slugify(query)
            dest_file = FIXTURES_DIR / f"{slug}.json"

            try:
                resp = await client.get(
                    f"{SEARCH_BASE_URL}/search",
                    params={
                        "q": query,
                        "page_size": 12,
                        "page": 1,
                        "fields": FIELDS,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    hits = data.get("hits", [])
                    print(f"Success ({len(hits)} hits, total: {data.get('count')})")
                    with open(dest_file, "w", encoding="utf-8") as out:
                        json.dump(data, out, indent=2, ensure_ascii=False)
                else:
                    print(f"HTTP {resp.status_code}")
            except Exception as e:
                print(f"Error: {e}")

            if idx < len(queries):
                await asyncio.sleep(8.5)

        # 1. Empty result fixture
        print("Recording empty fixture...")
        empty_fixture_file = FIXTURES_DIR / "empty.json"
        with open(empty_fixture_file, "w", encoding="utf-8") as out:
            json.dump({
                "count": 0,
                "is_count_exact": True,
                "page": 1,
                "page_size": 12,
                "page_count": 0,
                "hits": []
            }, out, indent=2)

        # 2. Malformed fixture (missing hits array / invalid types)
        print("Recording malformed fixture...")
        malformed_fixture_file = FIXTURES_DIR / "malformed.json"
        with open(malformed_fixture_file, "w", encoding="utf-8") as out:
            json.dump({
                "unexpected": "structure",
                "hits": "not-a-list"
            }, out, indent=2)

    print("\nSearch fixtures recording complete.")


if __name__ == "__main__":
    asyncio.run(record_fixtures())
