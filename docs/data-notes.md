# Open Food Facts Data Notes

## Official API Documentation Sources
- [Open Food Facts API Introduction (Tutorial, rate limits, User-Agent, staging server)](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial/)
- [Open Food Facts API v3 Reference](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-v3/)
- [Open Food Facts Barcode Normalization Reference](https://openfoodfacts.github.io/openfoodfacts-server/api/barcode-normalization/)
- [Open Food Facts Nutrition Data Representation Reference](https://openfoodfacts.github.io/openfoodfacts-server/api/nutrition-data/)

---

## 1. General API Requirements & Server Policy
- **User-Agent:** Mandatory. Format: `<AppName>/<Version> (<ContactEmailOrURL>)`. Set in Ingrivo as `Ingrivo/0.1.0 (yaadv@example.com)`.
- **Outbound Rate Limit:** Officially 15 product requests per minute per IP. Ingrivo's outbound sliding-window limiter is configured to `OFF_MAX_REQUESTS_PER_MIN=12` to guarantee compliance. Every fixture recording script and live test enforces at least 5 seconds between consecutive upstream requests.
- **API Version Pinning:** Pinned to `v3` via `OFF_API_VERSION=v3`. Endpoints use `/api/v3/product/{barcode}.json`.
- **Staging Server:** Located at `https://world.openfoodfacts.net`, requiring HTTP Basic Auth `off:off` (configured via `OFF_STAGING_BASIC_AUTH`).

---

## 2. Real Response Observations & Structure

### Found Products (`status: "success"`)
- Response contains top-level properties: `"code"`, `"status": "success"`, `"result"`, and `"product": { ... }`.
- Using the `fields` query parameter limits the payload to relevant schema fields:
  `code,product_name,brands,quantity,image_url,categories,ingredients_text,ingredients,nutrition_data_per,nutrition_data_prepared_per,nutriments,allergens,allergens_tags,last_modified_t,nutriscore_grade,nova_group,additives_tags`.

### Not-Found Products (`status: "failure"`)
- Observed on nonexistent or unregistered barcodes (e.g., `7622300710260`, `0000000000000`, `9999999999999`):
  Response has HTTP 404 or `"status": "failure"`, `"result": {"id": "product_not_found"}`, and an `errors` array.
- In Ingrivo, these map to `PRODUCT_NOT_FOUND` with available fallbacks: `["label_scan", "manual_search"]`.

### Nutrition Data & Basis Representation
- The basis is indicated by `nutrition_data_per`: `"100g"`, `"100ml"`, or `"serving"`.
- If `nutrition_data_per` is absent, blank, or unfamiliar, the normalizer marks basis as `"unknown"` without guessing.
- Specific nutrient amounts in `nutriments`:
  - Energy: `energy-kcal_100g`, `energy-kcal_serving`, `energy-kcal_value`, and `energy-kj_...`.
  - Macronutrients & minerals: `sugars_100g`, `proteins_100g`, `fat_100g`, `saturated-fat_100g`, `carbohydrates_100g`, `fiber_100g` (or `fibre_100g`), `sodium_100g`, `salt_100g`.
  - **Null vs Zero:** If a field is omitted in the source, it is normalized as `None` / `null`. A nutrient is **never** converted from missing to `0`.

### Ingredients & Language
- `ingredients_text`: Raw uninterrupted text string from the packaging.
- `ingredients`: An array of parsed ingredient objects with `text`, `percent_estimate`, etc. Only populated into normalized `items` when present; otherwise empty list.
- If language tags or multilingual fields exist (e.g. `ingredients_text_en`), English is preferred; otherwise default `ingredients_text`.

### Allergens
- Raw `allergens` string and `allergens_tags` array.
- **Critical Evidence Ledger Rule:** An empty allergen list from Open Food Facts represents *"none declared in source data / unknown"*, **never** *"allergen-free"*. The provenance is marked as `missing` when no allergens data was provided.

### Source Metadata & Open Food Facts Computed Fields
- `last_modified_t`: Integer UNIX timestamp, converted to ISO-8601 UTC.
- `retrieved_at`: Current timestamp of retrieval.
- `license`: Open Database License (`ODbL`).
- Open Food Facts' own calculated classifications (`nutriscore_grade`, `nova_group`, `additives_tags`) are isolated in `source_computed` so users can never mistake them for Ingrivo's analysis.

---

## 3. Data Completeness Score Formula

Completeness score is calculated as the ratio of present key fields out of 11:
1. `name` (present and non-empty)
2. `brand` (present and non-empty)
3. `ingredients.raw_text` (present and non-empty)
4. `energy_kcal` or `energy_kj` (non-null)
5. `sugars` (non-null)
6. `protein` (non-null)
7. `fat` (non-null)
8. `saturated_fat` (non-null)
9. `carbohydrates` (non-null)
10. `fibre` (non-null)
11. `sodium` or `salt` (either one present)
12. Known nutrition basis (`basis != "unknown"`)

$$\text{Completeness Score} = \frac{\text{Count of present key fields}}{11}$$

Fields missing from this list are itemized in `completeness.missing` for complete user transparency.

---

## 4. Inbound & Outbound Rate Limiting and Trust Assumptions

### Inbound Limiter (Client protection)
- `INBOUND_MAX_REQUESTS_PER_MIN=20` requests per minute per client IP.
- Client IP resolution behind Render:
  - Render acts as a TLS-terminating reverse proxy and forwards the client's public IP in the standard `X-Forwarded-For` header.
  - `get_client_ip()` extracts the first IP from `X-Forwarded-For`. If absent, it falls back to `request.client.host`.
  - Trust assumption: Render's ingress proxy strips spoofed incoming client headers before populating `X-Forwarded-For`.

### Outbound Limiter (Open Food Facts protection)
- `OFF_MAX_REQUESTS_PER_MIN=12` requests per minute globally.
- Sliding window mechanism (`deque` of timestamps).
- If exceeded, returns `429 UPSTREAM_RATE_LIMITED` with a `Retry-After: 60` header hint.

---

## 5. Coverage Check Script (`scripts/check_coverage.py`)

The manual verification script `backend/scripts/check_coverage.py` evaluates Open Food Facts catalog coverage for the test set in `docs/test-barcodes.txt` (mix of beverages, snacks, dairy, sweets, and invalid control barcodes).

### Running the Script
Run from the `backend/` directory using the virtual environment:
```bash
cd backend
.\.venv\Scripts\python.exe scripts/check_coverage.py
```

### Safety & Rate Limit Safeguards
- **In-App Client**: The script imports `fetch_off_product` and `normalize_off_product` directly from the backend app, ensuring it transmits the official `User-Agent` and pins `OFF_API_VERSION=v3`.
- **Delays**: Sleeps at least 5.0 seconds between consecutive requests.
- **Outbound Limiter Protection**: Evaluates `outbound_limiter.is_allowed("outbound_off")` prior to every request.
- **Rate Limit Break**: If a 429/503 is returned, the script immediately logs the status and halts to protect upstream infrastructure.
- **Never Run in CI**: This is a manual diagnostic utility only.

### How to Read the Coverage Report (`docs/coverage-report.md`)
- **Found / Not Found / Locally Rejected**: Summarizes hit rate against the test set.
- **Average Completeness**: Measures data density across key packaging fields.
- **Missing Key Fields**: Details which nutrients are omitted by source contributors (most frequently dietary fibre and separate sodium values). Missing fields remain `null`, never default to `0`.

