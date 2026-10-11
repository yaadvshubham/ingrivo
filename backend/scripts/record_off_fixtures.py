import asyncio
import json
import os
import sys
from pathlib import Path
import httpx

# Ensure backend root is in sys.path when running as a standalone script
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings

FIXTURES_DIR = BACKEND_DIR / "tests" / "fixtures" / "off"
BARCODES_FILE = BACKEND_DIR.parent / "docs" / "test-barcodes.txt"

async def fetch_and_save():
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    
    with open(BARCODES_FILE, "r") as f:
        barcodes = [line.strip() for line in f if line.strip()]
        
    auth = None
    if "openfoodfacts.net" in settings.OFF_BASE_URL and settings.OFF_STAGING_BASIC_AUTH:
        try:
            user, pwd = settings.OFF_STAGING_BASIC_AUTH.split(":", 1)
            auth = (user, pwd)
        except ValueError:
            pass
        
    headers = {"User-Agent": settings.OFF_USER_AGENT}
    
    fields = (
        "code,product_name,brands,quantity,image_url,categories,"
        "ingredients_text,ingredients,nutrition_data_per,nutrition_data_prepared_per,"
        "nutriments,allergens,allergens_tags,last_modified_t,nutriscore_grade,"
        "nova_group,additives_tags"
    )

    timeout = httpx.Timeout(10.0, connect=3.0, read=8.0, write=5.0, pool=5.0)
    async with httpx.AsyncClient(timeout=timeout, auth=auth, headers=headers) as client:
        for bc in barcodes:
            url = f"{settings.OFF_BASE_URL}/api/{settings.OFF_API_VERSION}/product/{bc}.json?fields={fields}"
            print(f"Fetching {bc}...")
            try:
                resp = await client.get(url)
                if resp.status_code == 404:
                    print(f"  Not found (404) for {bc}")
                elif resp.status_code != 200:
                    print(f"  Status {resp.status_code} for {bc}")
                
                try:
                    data = resp.json()
                except Exception:
                    data = {"raw_text_error": resp.text, "status": resp.status_code}
            except Exception as e:
                print(f"  Request failed for {bc}: {e}")
                data = {"error": str(e)}
                
            out_path = FIXTURES_DIR / f"{bc}.json"
            with open(out_path, "w", encoding="utf-8") as out:
                json.dump(data, out, indent=2, ensure_ascii=False)
                
            print(f"  Saved {out_path.name}")
            await asyncio.sleep(5)  # Rate limit protection (>= 5s between calls)

if __name__ == "__main__":
    asyncio.run(fetch_and_save())
