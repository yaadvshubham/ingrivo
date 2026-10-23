# Ingrivo Security Review & Audit Report

**Date of Audit:** October 2026  
**Auditor:** Antigravity Engineering  
**Scope:** Backend (FastAPI), Frontend (Next.js 16 / React 19), Build Artifacts, Git Repository History  

---

## 1. Executive Summary

Ingrivo was subjected to a comprehensive security and robustness audit covering:
1. Python dependencies vulnerability audit (`pip-audit`).
2. Node dependencies vulnerability audit (`npm audit`).
3. Repository-wide secret and credential scan (`scripts/secret_scan.py`).
4. Production bundle leak and env variable check (`scripts/bundle_check.py`).
5. HTTP security headers, CORS origin restrictions, and request body size caps.
6. Error handling, stack trace suppression, and PII/prompt log redaction.

**Result:** Zero active vulnerabilities in production runtime dependencies; zero leaked credentials or backend environment variables; strict CORS and request body limits enforced; and defense-in-depth security response headers deployed.

---

## 2. Dependency Audits

### 2.1 Backend (`pip-audit`)
- **Tool Version:** `pip-audit` 2.8.0 / Python 3.14 / PyPI Advisory Database
- **Execution:** `pip-audit` ran across all installed virtual environment packages (`backend/.venv`).
- **Result:**
  ```text
  No known vulnerabilities found
  ```
- **Finding:** **0 vulnerabilities**.

### 2.2 Frontend (`npm audit`)
- **Execution:** `npm audit` ran across all installed packages in `frontend/`.
- **Result:** 9 high severity vulnerability alerts.
- **Triage & Analysis:**
  All 9 alerts trace back to a single transitive dependency: `braces < 3.0.3` (Uncontrolled resource consumption via regex exponential backtracking in micromatch/fast-glob).
  - Dependency paths:
    1. `frontend > shadcn > fast-glob > micromatch > braces`
    2. `frontend > eslint-config-next > @typescript-eslint/parser > @typescript-eslint/typescript-estree > globby > fast-glob > micromatch > braces`
  - **Runtime Impact Assessment:**
    - `shadcn` is a CLI code generator run strictly by developers on local machines at development time.
    - `eslint-config-next` and `@typescript-eslint/parser` are development linter tools executed during `npm run lint` and CI.
    - None of these packages or their glob parsers run in the browser or on the Next.js production server.
    - Per guardrail instructions, breaking major version changes and `--force` overrides were omitted to prevent unstable builds.

---

## 3. Secret and Credential Scanning

### 3.1 Repository Scan (`scripts/secret_scan.py`)
- **Mechanism:** Scans all tracked files, staged changes, and full Git commit history using entropy heuristics and pattern matchers for:
  - Google Cloud / Gemini API Keys (`AIza[0-9A-Za-z-_]{35}`)
  - AWS Access Keys (`AKIA...`)
  - Generic private keys and authorization tokens
  - Open Food Facts basic auth strings
- **Result:**
  ```text
  [PASS] Clean scan: 0 potential secrets detected across repository and Git history.
  ```

### 3.2 Production Bundle Scan (`scripts/bundle_check.py`)
- **Mechanism:** Inspects all JavaScript chunks, CSS files, HTML pre-renders, and source maps in `frontend/.next` after `next build`.
- **Items Inspected:** 745 bundle files.
- **Verification Criteria:**
  1. No matches for API key regexes or private key headers.
  2. Zero occurrences of backend-only environment variable names:
     - `GEMINI_API_KEY`
     - `OFF_STAGING_BASIC_AUTH`
     - `SAL_BASE_URL`
     - `OFF_USER_AGENT`
- **Result:**
  ```text
  [PASS] 0 secret-like strings found in production bundle.
  [PASS] 0 leaked backend environment variable references.
  ```

---

## 4. HTTP Headers and Network Security

### 4.1 Backend Security Middleware (`backend/app/main.py`)
1. **Request Body Size Limit (HTTP 413):**
   - Implemented via `request_size_limit_middleware`.
   - Maximum allowed body: **1,048,576 bytes (1 MiB)**. Requests exceeding this return HTTP 413 Payload Too Large before memory exhaustion.
2. **Security Headers:**
   - `X-Content-Type-Options: nosniff` (prevents MIME type sniffing).
   - `Referrer-Policy: strict-origin-when-cross-origin` (prevents leaking internal URLs on external links).
   - `Cache-Control: no-store` on all 4xx and 5xx error responses (prevents caching transient failures or sensitive error states).
3. **CORS Configuration:**
   - Strict explicit origin validation based on `FRONTEND_ORIGIN` (default `http://localhost:3000`).
   - Wildcards (`*`) are disallowed when credentials/auth headers are present.
4. **Interactive Documentation Toggle:**
   - FastAPI `/docs` and `/redoc` are controlled by `DOCS_ENABLED` (defaults to `False` in production `APP_ENV=production`).

### 4.2 Frontend Security Headers (`frontend/next.config.ts`)
The Next.js configuration attaches the following headers to all incoming responses:
```http
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: camera=(self), geolocation=(), microphone=()
```

### 4.3 Content Security Policy (CSP) Report-Only Strategy
A Content Security Policy header is configured in **Report-Only** mode (`Content-Security-Policy-Report-Only`):
```text
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://images.openfoodfacts.net https://images.openfoodfacts.org;
connect-src 'self' http://localhost:8000 http://127.0.0.1:8000;
font-src 'self';
frame-ancestors 'none';
```

#### Rationale for Report-Only Mode:
- **WASM Modules & Next.js Turbopack:** `BarcodeDetector` (via `zxing-wasm`) and Tesseract OCR load WebAssembly modules and Web Workers. Prematurely enforcing `script-src` without hashes would break offline barcode scanning in production.
- **Enforcement Plan:**
  1. Deploy with `Content-Security-Policy-Report-Only` connected to a reporting endpoint.
  2. Collect violation reports from real clients during staging.
  3. Replace `'unsafe-eval'` with explicit WASM hash/worker allowances.
  4. Promote header to enforced `Content-Security-Policy`.

---

## 5. Error Handling & Information Leakage

1. **Stack Trace Suppression:**
   - An unhandled exception handler catches generic `Exception` instances and returns standard JSON:
     `{"detail": "Internal server error", "error_code": "INTERNAL_SERVER_ERROR", "status_code": 500}`.
   - Stack traces are logged to internal loggers only and never exposed to HTTP clients.
2. **Log Sanitization:**
   - Evidence text, raw OCR strings, user queries, and Gemini outputs are strictly excluded from logs.
   - Logs record only request IDs, HTTP status codes, latency in milliseconds, and token usage counts.
