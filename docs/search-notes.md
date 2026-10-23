# Open Food Facts Search-a-licious Notes (Step 5.0 Spike)

## 1. Documentation Sources & Official References
- **API Overview & Tutorial:** [Open Food Facts API Documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial/)
- **Search-a-licious GitHub Repository:** [openfoodfacts/search-a-licious](https://github.com/openfoodfacts/search-a-licious)
- **Search-a-licious Live OpenAPI 3.1 Spec:** [https://search.openfoodfacts.org/openapi.json](https://search.openfoodfacts.org/openapi.json)
- **Lucene Query Parser Syntax Reference:** [Apache Lucene 3.6 Query Parser](https://lucene.apache.org/core/3_6_0/queryparsersyntax.html)

---

## 2. API Parameters, Protocol, and Response Shape

- **Base URL:** `https://search.openfoodfacts.org`
- **Endpoint:** `/search` (GET)
- **Parameters Verified in OpenAPI Spec:**
  - `q`: String. Full-text search and Lucene query syntax. Words not recognized by the Lucene parser are executed as full-text search.
  - `page`: Integer (1-based, default 1).
  - `page_size`: Integer (default 10, Pinfo uses fixed 12).
  - `fields`: Comma-separated list of fields to include in each hit. Reduces network bandwidth and latency.
  - `langs`: Comma-separated language codes (defaults to `['en']`).
  - `sort_by`: Optional sort field.
- **User-Agent Requirement:**
  Mandatory per Open Food Facts terms. Format: `<AppName>/<Version> (<ContactEmailOrURL>)`.
  Pinfo transmits: `Pinfo/0.1.0 (yaadv@example.com)`.
- **Documented Rate Limits:**
  - The Open Food Facts API documentation mentions a general guideline of 10 requests/minute/IP for search endpoints.
  - While Search-a-licious's OpenAPI specification does not define an explicit HTTP header rate-limit contract, we adhere strictly to the conservative 10 requests/minute figure as our hard ceiling.
  - Pinfo sets `SEARCH_MAX_PER_MIN=8` (outbound limiter) and client inbound limit to `6` searches/minute to ensure full compliance.
- **Response Shape:**
  ```json
  {
    "count": 7410,
    "is_count_exact": true,
    "page": 1,
    "page_size": 12,
    "page_count": 618,
    "took": 45,
    "timed_out": false,
    "hits": [
      {
        "code": "5449000000996",
        "product_name": "Coca-Cola Original",
        "brands": "Coca-Cola",
        "image_front_url": "https://images.openfoodfacts.org/...",
        "categories": "Colas, Carbonated drinks",
        "ingredients_text": "...",
        "nutriments": { ... }
      }
    ]
  }
  ```

---

## 3. Query Sanitization & Lucene Neutralization
Because `q` accepts Lucene syntax, user inputs must be treated as **plain text** to prevent users from crafting expensive wildcard queries (e.g. `*`, `?`), malformed boolean expressions (e.g. `AND NOT OR`), or syntax errors.
Special Lucene characters: `+ - && || ! ( ) { } [ ] ^ " ~ * ? : \ /` are escaped with `\` or stripped, and control characters are removed.

---

## 4. Measured Fixture Observations
*(Recorded via `backend/scripts/record_search_fixtures.py` with 8+ second delays between calls)*

| Query | Hits Count | Name Present | Brand Present | Image Present | Ingredients Present | Nutriments Present |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `coca cola` | 12 | 100% | 100% | 100% | 91.7% | 100% |
| `nutella` | 12 | 100% | 100% | 100% | 83.3% | 100% |
| `pringles` | 12 | 100% | 100% | 100% | 100% | 100% |
| `lays` | 12 | 100% | 91.7% | 91.7% | 75.0% | 91.7% |
| `cadbury` | 12 | 100% | 100% | 100% | 83.3% | 100% |
| `kurkure` | 12 | 100% | 91.7% | 100% | 66.7% | 91.7% |
| `amul milk` | 12 | 100% | 100% | 91.7% | 50.0% | 91.7% |
| `parle g` | 12 | 100% | 91.7% | 91.7% | 75.0% | 100% |
| `nonexistentqueryxyz999` | 0 | - | - | - | - | - |

---

## 5. Country Filter Findings (Optional Step 5.1f)
Tested whether `countries_tags:"en:india"` or `countries_tags:en-india` could be appended cleanly. Because Search-a-licious taxonomy indexing for countries varies between raw country names and tag prefixes, appending naive Lucene country filters either drops valid Indian brand results or returns 0 hits. Per prompt instructions: *"If you cannot verify the exact filter syntax from the official docs, do NOT implement it; just document the finding."* We do not inject unverified country filters and allow the relevance engine to rank query terms naturally.
