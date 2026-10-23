# Known Limitations & Scope Boundaries

This document provides a realistic record of known limitations, environmental constraints, and scope boundaries in Ingrivo as of Phase 6.

---

## 1. On-Device Label OCR & Parsing Limitations

### A. Curved Packaging & Distorted Text
- **Bottles and Cans:** Cylindrical surfaces warp text toward the outer margins. Tesseract's line segmentation assumes planar text blocks and can drop or fragment numbers wrapped around edges.
- **Wrinkled Pouches / Foil:** Crinkled flexible pouches (chips, namkeen) cast sharp specular highlights and shadow folds that create false character tokens or break word sequences.

### B. Glare and Specular Reflections
- Plastic-laminated cartons and gloss foil packaging bounce direct room lighting or camera flashes, whiting out ingredient lists and nutrition numbers.
- **Guidance:** Users should angle packages slightly away from direct overhead light.

### C. Language Support (English-Only OCR)
- The current on-device OCR engine is loaded strictly with `@tesseract.js-data/eng` (English traineddata).
- **Hindi & Regional Indic Scripts:** Not recognized by the English LSTM model. Text in Devanagari appears as unparseable punctuation or is omitted entirely.
- **Bilingual Food Labels:** Many Indian consumer products print ingredients or claims in both English and Hindi. The English sections are parsed, while the Hindi script lines may generate stray noise tokens in raw text. The user review step allows editing or clearing these artifacts.

### D. Multi-Column Nutrition Formats
- Indian and global food packaging frequently provides dual columns: "Per 100g" alongside "Per Serve" (and sometimes "% RDA / % RI").
- **Column Choice Gating:** The parser automatically flags dual-column tables with `needs_column_choice: true`. The UI deliberately forces the user to explicitly pick which column to use rather than guessing.
- Values followed by `%` are never treated as nutrient grams.

### E. OCR Digit Confusion
- Tesseract frequently confuses glyphs with similar topologies under low resolution or noisy printing:
  - `O` or `o` for `0`
  - `l` or `I` for `1`
  - `S` or `s` for `5`
  - `B` for `8`
- **Rule:** The parser never silently "fixes" suspect numbers. It flags them with `ocr_suspect: true` and displays an amber warning in the review screen so the user can verify against the original label photo.

---

## 2. On-Device Camera Barcode Scanning Limitations

- **Lighting & Focus:** Fast QR code reading is facilitated by high-contrast finder patterns, whereas retail 1D linear barcodes (EAN-13, UPC-A) require clean contrast across thin vertical bars. Distant or low-light scans benefit from the 2x center ROI zoom and binarization passes, but extreme motion blur cannot be decoded.
- **Browser Origin / Insecure Contexts:** `navigator.mediaDevices.getUserMedia` is restricted by browser security policies to secure origins (`https://` or `localhost`). Unsecured IP access (e.g. `http://192.168.x.x`) triggers a clear warning with fallback to the manual barcode entry form.

---

## 3. Data Source Limitations (Open Food Facts)

- **Coverage Gaps:** Emerging and local Indian regional products frequently lack entries or have incomplete nutrient listings in Open Food Facts.
- **Community Data Quality:** Nutritional metrics in Open Food Facts are user-contributed. Missing nutrients remain `null` in Ingrivo (never assumed to be `0`).
- **Search Latency & Rate Limits:** The Search-a-licious API enforces an upstream rate limit (10 requests/minute/IP ceiling). Ingrivo implements client and server token-bucket rate limits and 1-hour response caching.

---

## 4. Local History, Offline & Image Hosting Boundaries (Phase 9)

### A. Browser-Local History Scope
- **Device & Profile Isolation:** Local history is saved exclusively within `localStorage` under `ingrivo.history.v1`. It does not sync between different browsers (e.g. Chrome vs Firefox), separate user profiles, or across devices.
- **Data Eviction & Capacity:** History is capped at 50 items. Saving a 51st item automatically evicts the least recently viewed product.
- **Storage Degradation in Private Browsing / Blocked Storage:** If browser storage is disabled (e.g., strict private browsing or quota exhaustion), Ingrivo falls back to an in-memory session store. An informational status badge alerts the user that history will not persist beyond the current browser session.
- **Label Product Retention:** Confirmed label products are saved to local history snapshot. If browser history is cleared, visiting a previous `/product/lb-<uuid>` URL will report that the product is no longer available in local history and prompt the user to recapture or upload the label photo again.

### B. Offline & Slow Network Operations
- **Cached Snapshots Offline:** Products previously viewed and saved to local history can be reopened and inspected while completely offline.
- **Network Dependency for New Data:** Looking up fresh barcodes, querying Open Food Facts search, or requesting new Gemini AI explanations requires an active network connection. Offline state is flagged via non-blocking status badges without interrupting local inspection features.

### C. Third-Party Image Hosting
- Packaging photos are loaded directly from Open Food Facts image servers (`images.openfoodfacts.org`).
- If an upstream image host is offline or experiences network outages, images fail gracefully and render an accessible, clearly labelled fallback placeholder card.

