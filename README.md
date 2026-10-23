# Ingrivo

> **Know what you eat. Understand what you buy.**

Ingrivo is an AI-powered packaged food and beverage intelligence web app. It combines Open Food Facts data, barcode scanning, label OCR, and AI explanations to help users understand what they consume.

## Current Status
- **Phase 1 Completed:** Foundation & Project Scaffolding.
- **Phase 2 Completed:** Design System, App Shell, WCAG Contrast Tests, and Homepage.
- **Phase 3 Completed:** Normalized Product Schema, Barcode Validation, Rate-Limited Open Food Facts Lookup, Manual Barcode Scanner UI, and Product Facts Page.
- **Phase 4 Completed:** On-Device Camera Barcode Scanner (Ponyfill + Self-Hosted ZXing WASM, Secure Context Check, Strict Double-Read Confirmation, Media Stream Teardown), Catalog Coverage Diagnostic Script, and Coverage Report.
- **Phase 7 Completed:** Evidence-Constrained Gemini AI Explanations (Strict evidence packets, structured Pydantic / TypeScript schemas, 24-hour SHA-256 hashed backend caching, zero-eval grounding/tools, refusal handling, privacy safeguards, and automated safety evaluation suite).
- **Phase 8 Completed:** Deterministic Product Comparison (Honest comparison schema, dual-product picker with search and manual barcode tabs, strictly non-comparable solid vs beverage gating, normalized basis alignment, table comparison with provenance, and neutral AI comparison narrative).
- **Phase 9 Completed:** Local Scan History, Accessibility, Responsive Polish & Edge Cases (Browser-only `localStorage` store with 50-item LRU eviction, cross-tab synchronization, undo removal, offline resilience with `navigator.onLine`, WCAG AA accessibility audit with skip link, single `h1`, landmarks, visible focus, table semantics, touch targets >= 44px, `prefers-reduced-motion`, plain lazy `<img>` with `no-referrer`, collapsible ingredient lists, and zero `dangerouslySetInnerHTML`).

---

## Local Setup (Windows PowerShell)

### 1. Backend Setup

Open a PowerShell terminal and run:

```powershell
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env

# Run the server
uvicorn app.main:app --reload
```
*The API will be available at `http://localhost:8000`.*

### 2. Frontend Setup

Open a new PowerShell terminal and run:

```powershell
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run the development server
npm run dev
```
*The frontend will be available at `http://localhost:3000`.*

---

## Running Tests

### Backend Tests
In the `backend` directory with the virtual environment activated:
```powershell
# Run standard offline unit and fixture tests (default)
.\.venv\Scripts\pytest

# Run live contract tests against Open Food Facts (optional, rate-limited)
.\.venv\Scripts\pytest -m live
```

### Frontend Tests
In the `frontend` directory:
```powershell
npm run test
npm run typecheck
npm run lint
npm run build
```
