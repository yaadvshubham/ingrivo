# Ingrivo Frontend

The frontend for **Ingrivo**, built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, and **Tailwind CSS**.

## Features

- **Barcode Scanning:** On-device camera barcode detection using ZXing WASM and Web Workers with robust fallback support.
- **Label Nutrition OCR:** Client-side OCR via Tesseract.js with structured parsing for ingredients, nutrition facts, and allergens.
- **Product Intelligence:** Detailed product facts, nutrition scores, and additives breakdown powered by Open Food Facts.
- **Deterministic Comparison:** Dual-product comparison engine with normalized solid/beverage basis alignment and provenance tracking.
- **AI Explanations & Assistant:** Evidence-constrained AI explanations and interactive real-time dietary chatbot assistant.
- **User Authentication:** Firebase Auth and Google OAuth integration with customizable dietary preferences, allergens, and health goals.
- **Local Scan History:** Private, offline-resilient `localStorage` scan history with cross-tab sync and 50-item LRU eviction.
- **Accessibility:** Built to WCAG 2.1 AA standards with full keyboard navigation, skip link, high contrast support, and screen reader compatibility.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

*(Assets for ZXing and Tesseract OCR will be automatically copied via the `postinstall` script).*

### 2. Configure Environment

Copy the example environment template:

```bash
cp .env.example .env.local
```

Configure your backend URL and Firebase/Google OAuth credentials in `.env.local`:

```ini
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

### 3. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

## Quality & Testing

```bash
# Run unit and integration tests (Vitest)
npm run test

# Type checking
npm run typecheck

# Code linting
npm run lint

# Production build
npm run build

# End-to-end tests (Playwright)
npm run test:e2e
```
