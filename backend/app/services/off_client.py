import httpx
import logging
from typing import Dict, Any

from app.core.config import settings

logger = logging.getLogger("ingrivo.off_client")

class ProductNotFound(Exception):
    pass

class UpstreamTimeout(Exception):
    pass

class UpstreamRateLimited(Exception):
    def __init__(self, retry_after: int = 60):
        self.retry_after = retry_after
        super().__init__(f"Rate limited. Retry after {retry_after}s.")

class UpstreamInvalidResponse(Exception):
    pass

async def fetch_off_product(barcode: str) -> Dict[str, Any]:
    """
    Fetches raw product data from Open Food Facts API v3.
    Applies timeouts and standardizes errors. Never retries in a loop.
    At most one retry for a connection error.
    """
    url = f"{settings.OFF_BASE_URL}/api/{settings.OFF_API_VERSION}/product/{barcode}.json"
    
    auth = None
    if "openfoodfacts.net" in settings.OFF_BASE_URL and settings.OFF_STAGING_BASIC_AUTH:
        try:
            user, pwd = settings.OFF_STAGING_BASIC_AUTH.split(":", 1)
            auth = (user, pwd)
        except ValueError:
            logger.warning("OFF_STAGING_BASIC_AUTH is malformed. Proceeding without auth.")
            
    headers = {
        "User-Agent": settings.OFF_USER_AGENT
    }
    
    fields = (
        "code,product_name,brands,quantity,image_url,image_front_url,selected_images,categories,"
        "ingredients_text,ingredients_text_en,ingredients,nutrition_data_per,nutrition_data_prepared_per,"
        "nutriments,allergens,allergens_tags,last_modified_t,nutriscore_grade,"
        "nova_group,additives_tags"
    )
    
    params = {"fields": fields}
    timeout = httpx.Timeout(10.0, connect=3.0, read=8.0, write=5.0, pool=5.0)
    
    async with httpx.AsyncClient(timeout=timeout, auth=auth, headers=headers) as client:
        try:
            response = await client.get(url, params=params)
        except httpx.TimeoutException:
            raise UpstreamTimeout()
        except (httpx.ConnectError, httpx.ConnectTimeout):
            # At most one retry for a connection error
            try:
                response = await client.get(url, params=params)
            except httpx.TimeoutException:
                raise UpstreamTimeout()
            except Exception as retry_exc:
                logger.error(f"Upstream connection failed on retry: {retry_exc}")
                raise UpstreamInvalidResponse(f"Upstream connection error: {retry_exc}")
        except httpx.RequestError as req_err:
            logger.error(f"Upstream request error: {req_err}")
            raise UpstreamInvalidResponse(f"Upstream request error: {req_err}")
            
        if response.status_code == 404:
            raise ProductNotFound()
        elif response.status_code in (429, 503):
            retry_after = int(response.headers.get("Retry-After", 60))
            raise UpstreamRateLimited(retry_after=retry_after)
        elif response.status_code != 200:
            logger.error(f"Upstream HTTP error {response.status_code}: {response.text}")
            raise UpstreamInvalidResponse(f"Unexpected HTTP status: {response.status_code}")
        
        try:
            data = response.json()
        except ValueError:
            raise UpstreamInvalidResponse("Invalid JSON returned by upstream")
            
        if data.get("status") == "failure" and "not found" in data.get("status_verbose", "").lower():
            raise ProductNotFound()
        if data.get("result", {}).get("id") == "product_not_found":
            raise ProductNotFound()
            
        if "product" not in data:
            raise UpstreamInvalidResponse("Missing 'product' object in upstream response")
            
        return data["product"]
