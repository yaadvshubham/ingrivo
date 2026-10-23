# Troubleshooting Guide

This guide covers common issues and resolutions across development, camera barcode scanning, Open Food Facts upstream integration, and production deployment.

---

## 1. Camera Barcode Scanning Issues

| Symptom | Likely Cause | Solution |
| :--- | :--- | :--- |
| **"Insecure context (HTTPS required)" alert** | Camera was opened on an unencrypted HTTP connection (e.g., `http://192.168.x.x`). Browser security policies restrict `navigator.mediaDevices.getUserMedia` to secure contexts. | Access the app via `localhost` (which browsers exempt) or through the deployed HTTPS URL (e.g., Vercel `https://...`). In the meantime, use the manual entry form directly below. |
| **"Camera permission was denied" alert** | The user clicked "Block" or browser previously saved permission refusal for the origin. | Click the permissions/tune icon next to the browser URL bar, enable Camera permissions, and reload the page or click "Start camera". The manual entry form remains ready at all times. |
| **"No camera available" alert** | Device lacks a connected webcam, camera hardware is disabled, or browser does not expose media devices. | Check if another peripheral webcam is plugged in. Enter the barcode digits manually using the persistent input form. |
| **"Camera is in use" alert** | Another application (Zoom, Teams, another browser tab) has acquired an exclusive hardware lock on the camera (`NotReadableError`). | Close other applications or tabs utilizing the camera and click "Retry Camera". |
| **Scanner viewfinder is black or frozen on iOS Safari** | Missing `playsInline` or `muted` attributes on the video tag, or iOS low-power mode paused playback. | Pinfo's video element is explicitly marked `playsInline` and `muted`. Ensure your iOS device allows autoplay and test using Safari. |
| **WASM reader fails to load or 404s** | `zxing_reader.wasm` was not copied into `frontend/public/wasm/`. | Run `npm run copy-wasm` or verify that the `postinstall` and `prebuild` scripts executed properly. Pinfo self-hosts the WASM module on the local origin. |
| **Camera light stays on after leaving page** | Background tracks were not released. | Pinfo automatically stops all active media stream tracks on unmount, when navigating on a successful scan, on clicking "Stop Camera", and whenever the browser tab becomes hidden (`document.visibilitychange`). |

---

## 2. Open Food Facts Upstream & Staging Issues

| Symptom | Likely Cause | Solution |
| :--- | :--- | :--- |
| **HTTP 401 Unauthorized from upstream** | Calling the Open Food Facts staging server (`https://world.openfoodfacts.net`) without required HTTP Basic Auth. | Ensure `backend/.env` has `OFF_STAGING_BASIC_AUTH=off:off`. On production (Render) with `https://world.openfoodfacts.org`, do NOT set basic auth. |
| **HTTP 503 / 429 Upstream Rate Limited** | Hitting Open Food Facts rate limit ($\ge 15$ req/min). | Check that `OFF_MAX_REQUESTS_PER_MIN=12` is respected. Wait 60 seconds before retrying. Pinfo scripts enforce at least 5-second delays between requests. |
| **Product found but nutrition basis is "Not Stated"** | Open Food Facts entry does not state `nutrition_data_per` ("100g", "serving", etc.). | This is expected and honest. Pinfo preserves this as `unknown` basis rather than guessing. |
| **Leading zero disappears from UPC-A barcode** | Barcode was parsed as a numeric integer rather than kept as a string. | Pinfo preserves barcodes as strict strings end-to-end (e.g. `012345678905` normalizes to `0012345678905`). |
| **Zod validation rejects upstream response** | Schema was too rigid on optional source fields. | All nutrient and source fields are nullable. Missing fields stay `null` and are never assumed `0`. |
| **CORS errors in browser console** | `ALLOWED_ORIGINS` in `backend/.env` does not match the frontend URL. | Add your frontend port/domain (e.g. `http://localhost:3000`) to `ALLOWED_ORIGINS`. |

---

## 3. Manual Entry Fallback

The manual barcode entry form on `/scan` is **always visible and functional**, regardless of camera permission state, hardware availability, or network status. Any valid 8-digit (EAN-8), 12-digit (UPC-A), or 13-digit (EAN-13) barcode can be entered directly.

---

## 4. Label Photo OCR Troubleshooting

| Symptom | Likely Cause | Solution |
| :--- | :--- | :--- |
| **"Please upload JPEG, PNG, or WebP"** | Uploading an iPhone `.heic` or `.heif` raw camera container. | Convert or export the photo as JPEG or PNG before uploading, or take the photo directly via the camera intake option. |
| **"OCR timed out after 60 seconds"** | Low-end mobile device CPU throttled during WebAssembly LSTM matrix calculations. | Click **"Enter manually"** on the error card to open the review screen immediately with empty fields, or retake a smaller, tighter crop of the nutrition panel. |
| **OCR produces garbled characters or missing lines** | Photo was taken at an angle, package has severe cylindrical curve, or camera flash washed out the label. | Rotate the photo with the 90° rotation buttons, or retake following the photo tips (flat surface, diffuse lighting, fill the frame). |
| **Hindi or bilingual text missing from ingredients** | On-device model is strictly English trained data (`@tesseract.js-data/eng`). | Hindi text is omitted by design to avoid hallucinated character sequences. Review and verify the English section or type missing items manually. |
| **"This label result is only kept in this browser tab..."** | Opened `/product/lb-<uuid>` in a different browser window, after closing the tab, or refreshed in private browsing mode. | Label products are stored in ephemeral `sessionStorage` purely in your browser for privacy. Scan or photograph the label again to review a new session. |
| **Assets fail to load or 404 on `/ocr/...`** | Self-hosted OCR files missing from `frontend/public/ocr/`. | Run `node scripts/copy-ocr-assets.mjs` or rebuild the project. Pinfo self-hosts the worker, WebAssembly core, and language data locally so no third-party CDN is contacted. |

