# Ingrivo Deployment Guide

This guide covers deploying the **Ingrivo** web application across modern cloud hosting platforms:
- **Frontend (Next.js 16 App Router)**: [Vercel](https://vercel.com) (Recommended) or [Netlify](https://netlify.com)
- **Backend (FastAPI Python Service)**: [Render](https://render.com), [Railway](https://railway.app), or any Docker host

---

## 1. Frontend Deployment (Vercel)

### Step 1: Connect Repository
1. Import your GitHub repository to Vercel.
2. Set the **Root Directory** to `frontend`.
3. Framework Preset: **Next.js** (Turbopack auto-detected).

### Step 2: Configure Build Settings
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### Step 3: Environment Variables
Add the following in **Vercel Project Settings → Environment Variables**:

| Variable Name | Description | Example / Source |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Deployed backend URL | `https://ingrivo-api.onrender.com` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Client API Key | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | `your-app.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID | `your-app-id` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | `your-app.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging ID | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web App ID | Firebase Console |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client | Google Cloud Console |
| `GEMINI_API_KEY` | Gemini AI Key (for AI chatbot) | [Google AI Studio](https://aistudio.google.com/app/apikey) |

---

## 2. Backend Deployment (Render)

### Step 1: Create a Web Service
1. Connect your repository on Render.
2. Set the **Root Directory** to `backend`.
3. Environment: **Python 3**.

### Step 2: Build & Start Commands
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Step 3: Persistent Disk (Optional for SQLite)
- To persist user accounts, logs, and audit records between redeploys, add a Persistent Disk mounted at `/opt/render/project/src/backend/data`.

### Step 4: Environment Variables
Add the following in **Render Environment Variables**:

| Variable Name | Value | Description |
|---|---|---|
| `APP_ENV` | `production` | Production mode |
| `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` | CORS whitelist for frontend |
| `OFF_USER_AGENT` | `Ingrivo/1.0.0 (contact@ingrivo.com)` | Polite User-Agent for Open Food Facts |
| `GEMINI_API_KEY` | `AIza...` | Google AI Studio Key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model |
| `ADMIN_EMAIL` | `your-admin@example.com` | Super admin account email |
| `ADMIN_PASSWORD` | `your-secure-password` | Super admin password |

---

## 3. Health & Verification

Once deployed, verify the endpoints:
1. **Backend Health Check**:
   ```bash
   curl https://your-backend.onrender.com/health
   # Returns: {"status": "ok", "app": "ingrivo-backend"}
   ```
2. **Frontend UI**:
   - Navigate to `https://your-frontend.vercel.app`.
   - Verify camera barcode scanner on mobile and desktop.
   - Test search, compare, and Nutri AI chatbot.
