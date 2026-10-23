# Pinfo — Architecture

> **Know what you eat. Understand what you buy.**

Pinfo is an AI-powered packaged food and beverage intelligence web app. It helps users understand packaged foods and beverages by combining Open Food Facts data, barcode scanning, label OCR and AI explanations. **Educational only: no medical advice, no "healthy/unhealthy" verdicts.**

---

## Core Principle — The Evidence Ledger

Every field has provenance: `source` | `ocr` | `user_corrected` | `derived` | `missing`.

- `null` means missing and is **never** turned into `0`.
- Source data, label text and AI interpretation are always visually separate.

---

## Stack

| Layer | Technology | Hosting |
|-------|------------|---------|
| Frontend | Next.js 16, App Router, TypeScript, Tailwind, shadcn/ui, Lucide | Vercel |
| Backend | FastAPI, Pydantic, httpx | Render free tier |

---

## Architecture Style

**Modular monolith.** Backend is stateless; in-memory cache is best-effort only.

**Rate Limiting & Caching (Open Food Facts):**
- In-memory TTLCache (LRU) for product lookups.
- In-memory sliding window rate limiter (Inbound per-IP, Outbound globally to OFF).

---

## Data Flow Rules

- The frontend **never** calls Open Food Facts or Gemini directly.
- The backend holds the Gemini key, sets the Open Food Facts User-Agent, enforces cache and rate limits, and normalizes data.
- Camera frames and label photos **never leave the device**. Barcode decoding and OCR run in the browser.
- Label parsing runs in the browser (TypeScript); the backend re-validates reviewed data with Pydantic.

---

## Routes (Frontend)

| Route | Purpose |
|-------|---------|
| `/` | Homepage |
| `/search` | Product search |
| `/scan` | Barcode scanner |
| `/label` | Label OCR |
| `/product/[ref]` | Product detail (`ref` = `bc-<barcode>` or `lb-<uuid>`) |
| `/compare` | Side-by-side comparison |
| `/history` | Local history |
| `/about` | About page |

---

## API Endpoints (Backend — `/api/v1`)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health check |
| `GET` | `/products/barcode/{code}` | Fetch product by barcode |
| `GET` | `/products/search` | Search products |
| `POST` | `/analysis/explain` | AI explanation of product |
| `POST` | `/analysis/ask` | Follow-up questions (stretch) |
| `POST` | `/compare` | Compare products |

---

## Error Envelope

```json
{
  "error": {
    "code": "...",
    "message": "...",
    "request_id": "..."
  }
}
```

---

## Gemini Configuration

- The model ID comes from the `GEMINI_MODEL` env var; **never hard-code it**.
- English-only MVP.

---

## History

- `localStorage`, 50 items, no images.
- No accounts, no server database.

---

## Approved Decisions

| Decision | Choice |
|----------|--------|
| Open Food Facts access | Backend proxy |
| Search UX | Submit-based (not live) |
| OCR engine | Browser Tesseract.js |
| Derived values | kJ↔kcal and salt↔sodium only, always flagged |
| Frontend package manager | npm |
| Backend package manager | venv + pip |
| Deploy strategy | Early walking-skeleton deploy |

---

## Cost Target

**₹0.** Flag any action that could trigger billing.
