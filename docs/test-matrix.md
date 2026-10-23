# Ingrivo Test Matrix & Error-Handling Audit

**Scope:** End-to-End, Integration, Unit, and Manual Test Coverage for All User-Facing Flows and Failure Modes.  
**Last Updated:** October 2026  

---

## 1. Test Suite Summary

| Layer | Runner / Tool | Target / Browsers | Test Count | Pass Rate | Coverage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend Unit & Integration** | `pytest` + `pytest-cov` | Python 3.14 / FastAPI | 104 tests | **100%** (104 passed) | **82% statements** |
| **Frontend Unit & Component** | `vitest` + `@vitest/coverage-v8` | jsdom / React 19 | 130 tests | **100%** (130 passed) | **63.2% lines / 61.5% stmts** |
| **End-to-End (E2E) Workflows** | `@playwright/test` | Desktop Chromium | 20 tests | **100%** (20 passed) | Full functional flows |
| **End-to-End Mobile** | `@playwright/test` | Mobile Chromium (Pixel 5) | 20 tests | **100%** (20 passed) | Touch & responsive |
| **End-to-End Mobile WebKit** | `@playwright/test` | Mobile WebKit (iPhone 12) | 20 tests | **100%** (20 passed) | WebKit rendering & touch |
| **Accessibility Audit** | `@axe-core/playwright` | All 8 core application routes | 8 assertions | **100%** (0 serious/critical) | WCAG 2.1 AA |

---

## 2. Stage 1 Error Table & Failure Mode Matrix

This matrix maps every error condition and edge case defined in the architecture specification to its automated test or manual check.

| Error Case / Condition | Expected Behavior | Automated Test Location | Status |
| :--- | :--- | :--- | :--- |
| **Barcode Bad Check Digit** | Form displays inline alert "Invalid barcode check digit"; navigation blocked. | `frontend/src/tests/phase3.test.tsx`<br>`frontend/e2e/flows.spec.ts` | **PASS** |
| **Barcode Empty Input** | Form displays inline alert "Please enter a barcode number"; submission blocked. | `frontend/src/tests/phase3.test.tsx` | **PASS** |
| **Barcode Leading Zero** | Normalizes 12-digit UPC to 13 digits with leading zero intact; navigates correctly. | `frontend/src/tests/phase3.test.tsx`<br>`backend/tests/test_api.py` | **PASS** |
| **Product Not Found (404)** | Renders friendly "Product not found" state with fallback action buttons (Search, Scan Label). | `frontend/src/tests/phase3.test.tsx`<br>`frontend/e2e/flows.spec.ts`<br>`backend/tests/test_products.py` | **PASS** |
| **Upstream OFF Rate Limited (429/503)** | Displays "Open Food Facts is temporarily rate-limiting requests" with retry button. | `frontend/src/tests/phase3.test.tsx`<br>`frontend/src/tests/search.test.tsx`<br>`backend/tests/test_products.py` | **PASS** |
| **Slow Backend Response (>3s)** | Displays persistent notice "Fetching product data from Open Food Facts..." while waiting. | `frontend/e2e/flows.spec.ts`<br>`frontend/src/app/product/[ref]/page.tsx` | **PASS** |
| **Malformed Backend Payload** | Zod schema validation fails cleanly; displays graceful invalid payload alert without crashing. | `frontend/e2e/flows.spec.ts`<br>`frontend/src/tests/phase3.test.tsx` | **PASS** |
| **Camera Permission Denied** | Displays camera blocked notice with instructions on how to enable camera in browser settings. | `frontend/src/tests/scanner.test.tsx`<br>`frontend/e2e/flows.spec.ts` | **PASS** |
| **No Camera Device Available** | Maps `NotFoundError` to friendly "No camera detected" message; provides manual entry link. | `frontend/src/tests/scanner.test.tsx` | **PASS** |
| **Camera Insecure Context** | In HTTP context (non-HTTPS/localhost), blocks camera requests and displays clear warning. | `frontend/src/tests/scanner.test.tsx` | **PASS** |
| **Search Empty Query** | Submit button disabled; pressing enter does not trigger search. | `frontend/src/tests/search.test.tsx`<br>`frontend/e2e/flows.spec.ts` | **PASS** |
| **Search Rate Limited (429)** | Displays clear error message with retry button; preserves previous search input. | `frontend/src/tests/search.test.tsx`<br>`frontend/e2e/flows.spec.ts`<br>`backend/tests/test_search.py` | **PASS** |
| **Search Debounce / Submit-Only** | Typing does NOT trigger API requests; queries fire strictly on form submit or Enter key. | `frontend/src/tests/search.test.tsx`<br>`frontend/e2e/flows.spec.ts` | **PASS** |
| **Label OCR Missing Fields** | Displays inline editable review form; user can type or correct unrecognized values. | `frontend/src/tests/label-flow.test.tsx`<br>`frontend/e2e/label.spec.ts` | **PASS** |
| **Label Review Gating** | User cannot save or view label product without confirming basis (100g / 100ml / serving). | `frontend/src/tests/label-flow.test.tsx`<br>`frontend/e2e/label.spec.ts` | **PASS** |
| **Label Two Columns Detected** | Prompts user to choose which column to review (e.g., Per 100g vs Per Serving). | `frontend/src/tests/label-flow.test.tsx` | **PASS** |
| **Label Flow Zero Network Calls** | Ensures OCR, text parsing, and review flow make 0 network requests; 100% on-device. | `frontend/src/tests/label-flow.test.tsx` | **PASS** |
| **Compare Solid vs Beverage** | Mathematical engine flags products as "not directly comparable" with clear rationale. | `backend/tests/test_compare.py`<br>`frontend/e2e/flows.spec.ts` | **PASS** |
| **Compare Missing Data** | Displays "Not available" for missing nutrients; omits false differences. | `backend/tests/test_compare.py`<br>`frontend/e2e/flows.spec.ts` | **PASS** |
| **Compare Responsive Layout** | Renders side-by-side on wide screens; stacks into cards on 360px mobile without horizontal scrolling. | `frontend/src/tests/compare.test.tsx`<br>`frontend/e2e/flows.spec.ts` | **PASS** |
| **Gemini Unconfigured / Missing Key** | Explanations degrade gracefully; UI displays facts only with "AI explanations unconfigured" note. | `backend/tests/test_analysis.py`<br>`frontend/src/tests/ai-explanation.test.tsx`<br>`frontend/e2e/flows.spec.ts` | **PASS** |
| **Gemini Rate Limited (429)** | UI displays facts only with "AI rate limit reached; showing verified facts" notice. | `frontend/src/tests/ai-explanation.test.tsx`<br>`frontend/e2e/flows.spec.ts` | **PASS** |
| **Gemini Invalid Structured Output** | Pydantic/Zod validator rejects hallucinations or malformed JSON; displays fallback without crash. | `backend/tests/test_analysis.py`<br>`frontend/src/tests/ai-explanation.test.tsx` | **PASS** |
| **Gemini Zero Unprompted Calls** | Page load never initiates Gemini requests; triggered strictly by user button click. | `frontend/src/tests/ai-explanation.test.tsx` | **PASS** |
| **Local History Quota Exceeded** | Evicts oldest items automatically and preserves newest without throwing unhandled exceptions. | `frontend/src/tests/history.test.ts` | **PASS** |
| **Local History Schema Mismatch** | Resets corrupt JSON or unexpected versions to empty store gracefully without white-screen crash. | `frontend/src/tests/history.test.ts` | **PASS** |
| **Local History Undo / Clear** | User can clear all items or delete individual items with undo restoration. | `frontend/src/tests/history.test.ts`<br>`frontend/e2e/flows.spec.ts` | **PASS** |
| **Offline Mode Banner** | When `navigator.onLine` is false, displays offline warning banner with snapshot indicator. | `frontend/src/tests/edge-cases.test.tsx`<br>`frontend/src/app/product/[ref]/page.tsx` | **PASS** |
| **Request Body Limit (413)** | POST requests with bodies > 1 MiB return HTTP 413 Payload Too Large. | `backend/tests/test_security.py` | **PASS** |
| **Security Headers Present** | `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Cache-Control: no-store` on errors. | `backend/tests/test_security.py`<br>`frontend/next.config.ts` | **PASS** |
| **XSS Immunity** | Script tags in ingredient strings or product names are escaped and rendered as text. | `frontend/src/tests/edge-cases.test.tsx` | **PASS** |
| **WCAG 2.1 AA Violations** | Axe-core scans across all 8 routes find 0 critical or serious accessibility violations. | `frontend/e2e/accessibility.spec.ts` | **PASS** |
