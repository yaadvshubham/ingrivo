# Gemini API Spike Notes

> Official SDK: `google-genai` version 2.29.0 (pinned in `backend/requirements.txt`)  
> Target Model Config: Configured dynamically via `GEMINI_MODEL` (e.g. `gemini-2.5-flash` or `gemini-1.5-flash`).

---

## 1. SDK Selection and Initialization

- **Selected SDK**: Official Google GenAI Python SDK (`google-genai==2.29.0`).
- **Citation**: [Google GenAI Python SDK Repository & Documentation](https://github.com/googleapis/python-genai) and [Google AI Studio Gemini API Quickstart](https://ai.google.dev/gemini-api/docs/quickstart?lang=python).
- **Client Instantiation**:
  ```python
  from google import genai
  from google.genai import types

  client = genai.Client(api_key=settings.GEMINI_API_KEY)
  ```
- **Model ID Supply**: Model ID is never hard-coded. It is passed directly to `client.models.generate_content(model=settings.GEMINI_MODEL, ...)` from `settings.GEMINI_MODEL`.

---

## 2. Structured Output via `GenerateContentConfig`

- **Citation**: [Gemini API Structured Outputs Guide](https://ai.google.dev/gemini-api/docs/structured-output?lang=python).
- **Mechanism**: The SDK supports passing a Pydantic `BaseModel` class directly into `GenerateContentConfig(response_mime_type="application/json", response_schema=ExplainSchema)`.
- **Supported Schema Features & Constraints**:
  - Requires clean, flat, non-recursive schemas.
  - Primitive types (`str`, `int`, `float`, `bool`), lists of objects, and string enums are supported.
  - Unions (`Union[X, Y]`) and recursive references must be avoided to guarantee deterministic parsing.
  - The model outputs raw JSON conforming to the schema in `response.text`.
  - In `google-genai`, `response.parsed` provides the validated Pydantic model instance directly if `response_schema` was passed.

---

## 3. Error Handling and Quota Mappings

- **Citation**: [Gemini API Error Codes and Rate Limits](https://ai.google.dev/gemini-api/docs/troubleshooting).
- **Error Types**:
  - `429 RESOURCE_EXHAUSTED` / Rate Limit: Map to typed `AiQuotaError` -> `AI_UNAVAILABLE` (reason: `quota`).
  - `401/403 PERMISSION_DENIED` / Auth: Map to typed `AiAuthError` -> `AI_NOT_CONFIGURED` or `AI_UNAVAILABLE` (reason: `auth`).
  - `404 NOT_FOUND`: Model ID retired or invalid -> `AI_UNAVAILABLE` (reason: `model_not_found`).
  - `TimeoutError` / ReadTimeout: Map to typed `AiTimeoutError` -> `AI_UNAVAILABLE` (reason: `timeout`).
  - `Prompt/Response Safety Block` (`finish_reason == "SAFETY"`): Map to typed `AiSafetyBlockError` -> `AI_UNAVAILABLE` (reason: `safety`).
  - `Truncation` (`finish_reason == "MAX_TOKENS"`): Map to typed `AiTruncationError` -> `AI_INVALID_OUTPUT`.

---

## 4. Security & Logging Non-Negotiables

- **API Key Security**: The API key is loaded only from `backend/.env`. It is never logged, never returned to the frontend, and `/health` reports only `gemini_configured: true/false`.
- **No Grounding / Tools**: Tools, search grounding, and code execution are explicitly disabled (`tools=None`). Structured text extraction only.
- **Logging Policy**: Request ID, status, latency (ms), and token counts are logged. Raw product text, label evidence, and raw model completions are strictly excluded from all log records.
- **Cost / Quota Defenses**:
  - Global daily in-memory ceiling (`GEMINI_MAX_CALLS_PER_DAY=100`, resets at UTC midnight or restart).
  - Per-client token-bucket rate limiter (`EXPLAIN_RATE_LIMIT=5` per 10 minutes).
  - Evidence character limit (`MAX_EVIDENCE_CHARS=4000`, rejects with `PAYLOAD_TOO_LARGE` if exceeded).
  - Maximum 2 model attempts per request (1 initial + 1 validation-directed retry).
