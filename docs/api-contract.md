# Ingrivo API Contract

## Standard Error Envelope
All error responses (4xx and 5xx) follow a consistent JSON envelope:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "request_id": "uuid-string"
  }
}
```

### Standard Error Codes
| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `INVALID_BARCODE` | Barcode format, length, or check-digit validation failed |
| 400 | `INVALID_QUERY` | Search query length outside 2-80 characters or invalid page |
| 404 | `PRODUCT_NOT_FOUND` | Barcode not found in Open Food Facts (`fallbacks: ["label_scan", "manual_search"]`) |
| 429 | `RATE_LIMITED` | Inbound client rate limit exceeded (20 req/min for barcodes, 6 req/min for search) |
| 429 | `UPSTREAM_RATE_LIMITED` | Outbound Open Food Facts limiter reached (12 req/min OFF, 8 req/min Search) |
| 502 | `UPSTREAM_INVALID_RESPONSE` | Upstream returned invalid JSON or unexpected response structure |
| 503 | `UPSTREAM_RATE_LIMITED` | Open Food Facts upstream returned 429 or 503 |
| 504 | `UPSTREAM_TIMEOUT` | Timeout while connecting to or reading from Open Food Facts / Search |

---

## GET `/api/v1/products/barcode/{code}`
Fetches, caches, and normalizes a product by barcode.

### Request
```http
GET /api/v1/products/barcode/5449000000996 HTTP/1.1
Host: api.ingrivo.com
User-Agent: Ingrivo-Frontend/0.1.0
```

### Response `200 OK` (Normalized Product Schema)
Taken from real Open Food Facts fixture `5449000000996.json`:
```json
{
  "ref": "bc-5449000000996",
  "kind": "food",
  "name": "Coca-Cola",
  "name_provenance": "source",
  "brand": "Coca-Cola",
  "brand_provenance": "source",
  "quantity": null,
  "quantity_provenance": "missing",
  "image_url": "https://images.openfoodfacts.net/images/products/544/900/000/0996/front_en.1035.400.jpg",
  "image_provenance": "source",
  "categories": [
    "Colas",
    "Sweetened beverages",
    "pt:bebidas cafeína"
  ],
  "categories_provenance": "source",
  "ingredients": {
    "raw_text": "carbonated water, sugar, colour (caramel E150d), acid (phosphoric acid), natural flavourings including caffeine.",
    "items": [
      "carbonated water",
      "sugar",
      "e150d",
      "phosphoric acid",
      "natural flavourings including caffeine"
    ],
    "language": "en",
    "provenance": "source"
  },
  "nutrition": {
    "basis": "per_100g",
    "serving_size": null,
    "values": {
      "energy_kcal": 42.0,
      "energy_kj": 180.0,
      "sugars": 10.6,
      "protein": 0.0,
      "fat": 0.0,
      "saturated_fat": 0.0,
      "carbohydrates": 10.6,
      "fibre": null,
      "sodium": 0.0,
      "salt": 0.0
    },
    "provenance": "source"
  },
  "allergens": {
    "declared": [],
    "traces": [],
    "provenance": "missing"
  },
  "source": {
    "name": "Open Food Facts",
    "api_version": "v3",
    "product_url": "https://world.openfoodfacts.org/product/5449000000996",
    "last_modified": "2024-03-22T08:14:02+00:00",
    "retrieved_at": "2026-10-11T15:30:00+00:00",
    "license": "ODbL"
  },
  "completeness": {
    "score": 0.92,
    "missing": [
      "fibre"
    ]
  },
  "source_computed": {
    "nutriscore": "e",
    "nova_group": 4,
    "additive_tags": [
      "en:e150d",
      "en:e338"
    ]
  }
}
```

### Error Example: `404 Not Found`
```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product not found. Fallbacks available. {\"fallbacks\": [\"label_scan\", \"manual_search\"]}",
    "request_id": "c7a8b411-d922-4a0b-85d8-c11c1d89e5f1"
  }
}
```

### Error Example: `400 Bad Request`
```json
{
  "error": {
    "code": "INVALID_BARCODE",
    "message": "The provided barcode is invalid.",
    "request_id": "b3e1a029-4781-43ef-92e1-884cbf5e9211"
  }
}
```

---

## GET `/api/v1/products/search`
Searches packaged foods via Search-a-licious full-text search, with Lucene neutralization, caching (1h), and rate limits.

### Request
```http
GET /api/v1/products/search?q=coca+cola&page=1 HTTP/1.1
Host: api.ingrivo.com
```

### Parameters
- `q`: String (required, 2-80 characters). Neutralized against raw Lucene operators.
- `page`: Integer (optional, 1-5, default 1).

### Response `200 OK`
```json
{
  "query": "coca cola",
  "page": 1,
  "page_size": 12,
  "total": 7410,
  "page_count": 618,
  "results": [
    {
      "ref": "bc-5449000000996",
      "name": "Coca-Cola Original",
      "brand": "Coca-Cola",
      "image_url": "https://images.openfoodfacts.org/images/products/544/900/000/0996/front_en.1129.400.jpg",
      "categories": [
        "Colas",
        "Sweetened beverages"
      ],
      "has_ingredients": true,
      "nutrition_availability": "most",
      "source": "Open Food Facts"
    }
  ]
}
```

