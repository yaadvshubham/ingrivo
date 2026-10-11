# Privacy and Data Flow Architecture

This document details exactly what data is transmitted, processed, stored, and shared when using Ingrivo, in compliance with our zero-retention principles.

---

## 1. Barcode Lookup Data Flow
- **Input**: 8, 12, or 13-digit linear barcode numbers (e.g., `8901030383701`).
- **Processing**: Normalized on server. Checked against server in-memory LRU cache (24-hour TTL).
- **Upstream Query**: If not in cache, queried against Open Food Facts Public API (`https://world.openfoodfacts.org`).
- **Storage**: No user-identifying data or device identifiers are recorded.

---

## 2. On-Device Label Photo & OCR Data Flow
- **Zero Photo Upload**: When you photograph or upload a food packaging label, **the image is processed 100% locally on your device** inside the browser using self-hosted WebAssembly and Tesseract.js.
- **No Remote Storage**: Images and camera video frames are **never** uploaded to our servers, never stored in `localStorage`, and never sent to any third party. Object URLs generated during intake are explicitly revoked.
- **Session Storage**: The reviewed text and nutrition numbers are stored solely in ephemeral browser `sessionStorage` under reference `lb-<uuid>`. Closing the browser tab erases the record immediately.

---

## 3. Gemini AI Explanations Data Flow (Phase 7)

When you explicitly click **"Explain this product"**:

### What Is Sent
- **For Barcode Products**: Only the barcode is sent to our backend. The backend retrieves the canonical product data from the verified catalog cache.
- **For Label Products**: Only the text strings (Product Name, Brand, Ingredients) and validated nutrition numbers you reviewed in the table are sent.
- **Never Sent**: Photos, images, user accounts, geolocation, or browser fingerprints are **never** sent to the backend or AI provider.

### Where It Goes
1. Sent to Ingrivo's backend server via `POST /api/v1/analysis/explain`.
2. Normalized into an explicit, character-capped Evidence Packet (`MAX_EVIDENCE_CHARS=4000`).
3. Sent securely to **Google's Gemini API** via the official Google GenAI Python SDK using `GenerateContentConfig(response_schema=ExplainStructuredData)`.

### Google Gemini API Terms & Free-Tier Notice
- Under Google's current API terms for developer free-tier accounts, prompts and generated outputs may be processed by Google to provide and improve services in accordance with [Google's Privacy Policy](https://policies.google.com/privacy) and [Gemini API Terms of Service](https://ai.google.dev/gemini-api/terms).
- **User Advisory**: Do not include personal names, addresses, or private information in free-text fields or label review forms.
- **No Grounding or External Tools**: Search grounding, code execution, and web crawling tools are disabled on the API call.

---

## 4. Backend Logging Safeguards
- **Excluded**: Evidence text, ingredient text, user queries, and AI model completions are **strictly excluded** from backend logs.
- **Included**: Request ID, HTTP status code, latency (ms), and token counts only.
- **No Secret Leakage**: The `GEMINI_API_KEY` is loaded only in backend environment variables. The `/health` endpoint exposes only a boolean `gemini_configured: true/false`.
