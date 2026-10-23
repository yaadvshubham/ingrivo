# Ingrivo Backend API

The FastAPI backend powering **Ingrivo**, an AI-powered packaged food and beverage intelligence platform.

## Architecture & Features

- **FastAPI & Pydantic:** Strict typed request and response models with asynchronous endpoints.
- **Open Food Facts Integration:** Rate-limited upstream API integration with resilient caching and barcode normalization.
- **Evidence-Constrained Gemini AI:** Structured JSON nutrition explanations and comparisons grounded strictly in factual food data with safety guardrails.
- **Authentication & User Management:** Google OAuth 2.0 token verification, Firebase integration, and session management.
- **Admin Dashboard & Auditing:** Super Admin panel for user management, real-time activity auditing, and scan statistics with SQLite persistence.
- **Security & Privacy:** Sliding-window rate limiters, token buckets, secret scanners, and zero-eval data handling.

## Quick Start

### 1. Environment Setup

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your configuration values:
- `GEMINI_API_KEY`: Google Gemini API key (server-side only)
- `OFF_USER_AGENT`: User agent for Open Food Facts queries
- `DOCS_ENABLED`: Set to `True` for `/docs` Swagger UI access in development

### 3. Run Development Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Interactive OpenAPI docs will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

## Testing

```bash
# Run unit & offline fixture tests
pytest

# Run live contract tests against Open Food Facts (rate-limited)
pytest -m live

# Run secret scanning audit
python ../scripts/secret_scan.py
```
