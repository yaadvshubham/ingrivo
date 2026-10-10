# Ingrivo

> **Know what you eat. Understand what you buy.**

Ingrivo is an AI-powered packaged food and beverage intelligence web app. It combines Open Food Facts data, barcode scanning, label OCR, and AI explanations to help users understand what they consume.

## Current Status
**Phase 1 Completed:** Foundation & Project Scaffolding
- Git initialized.
- Next.js 16 frontend scaffolded with TypeScript, Tailwind, and Vitest.
- Python FastAPI backend scaffolded with request-ID middleware, CORS, and robust error handling.
- Basic API health check endpoint and frontend status diagnostic page implemented.

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

## Running Tests

### Backend Tests
In the `backend` directory with the virtual environment activated:
```powershell
pytest
```

### Frontend Tests
In the `frontend` directory:
```powershell
npm run test
npm run typecheck
npm run lint
```
