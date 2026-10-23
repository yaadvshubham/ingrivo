"""Pinfo Backend — FastAPI Application."""

import uuid
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings, APP_VERSION
from app.core.errors import error_envelope
from app.routers import health, products

logger = logging.getLogger("ingrivo")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Pinfo backend starting (env=%s)", settings.APP_ENV)
    try:
        from app.db.database import init_db
        init_db()
        logger.info("Pinfo SQLite database initialized successfully.")
    except Exception as e:
        logger.error("Failed to initialize database: %s", e)
    yield
    logger.info("Pinfo backend shutting down")


app = FastAPI(
    title="Pinfo API",
    version=APP_VERSION,
    docs_url="/docs" if settings.is_docs_enabled else None,
    openapi_url="/openapi.json" if settings.is_docs_enabled else None,
    redoc_url=None,
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)


# ---------------------------------------------------------------------------
# Middleware — Security Headers & Error Cache-Control
# ---------------------------------------------------------------------------
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Attach standard security headers and error Cache-Control to all API responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if response.status_code >= 400:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return response


# ---------------------------------------------------------------------------
# Middleware — Request Body Size Limit
# ---------------------------------------------------------------------------
@app.middleware("http")
async def request_size_limit_middleware(request: Request, call_next):
    """Enforce body size limit for POST, PUT, and PATCH bodies."""
    if request.method in ("POST", "PUT", "PATCH"):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length = int(content_length)
                if length > settings.MAX_REQUEST_BODY_BYTES:
                    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
                    return JSONResponse(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        content=error_envelope(
                            code="PAYLOAD_TOO_LARGE",
                            message=f"Request payload exceeds the maximum allowed limit of {settings.MAX_REQUEST_BODY_BYTES} bytes.",
                            request_id=request_id,
                        ),
                    )
            except ValueError:
                pass
    return await call_next(request)


# ---------------------------------------------------------------------------
# Middleware — Request ID
# ---------------------------------------------------------------------------
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Attach a unique request ID to every request/response."""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id

    # Log request summary (never log bodies, auth headers or keys)
    logger.info(
        "request_id=%s method=%s path=%s status=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
    )
    return response


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------
from app.core.errors import AppError

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    """Handle application-level typed errors."""
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=exc.status_code,
        content=error_envelope(
            code=exc.code,
            message=exc.message,
            request_id=request_id,
            details=exc.details or None,
        ),
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic / FastAPI validation errors."""
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=error_envelope(
            code="VALIDATION_ERROR",
            message="Invalid request data. Check the request body or parameters.",
            request_id=request_id,
        ),
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions (404, 405, etc.)."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    code = f"HTTP_{exc.status_code}"
    message = str(exc.detail)
    
    # Allow routers to specify custom codes by prefixing detail with CODE:
    if ":" in message:
        potential_code, rest = message.split(":", 1)
        if potential_code.replace("_", "").isalpha() and potential_code.isupper():
            code = potential_code
            message = rest

    return JSONResponse(
        status_code=exc.status_code,
        content=error_envelope(
            code=code,
            message=message,
            request_id=request_id,
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all for unexpected errors. Never leak stack traces."""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception("Unhandled error request_id=%s", request_id)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_envelope(
            code="INTERNAL_ERROR",
            message="An unexpected error occurred.",
            request_id=request_id,
        ),
    )


@app.get("/health", tags=["health"])
async def root_health():
    """Root health check for cloud platform monitors (Render/Railway)."""
    return {
        "status": "ok",
        "version": APP_VERSION,
        "environment": settings.APP_ENV,
        "gemini_configured": settings.gemini_configured,
    }


from app.routers import health, products, analysis, compare, auth, userdata, admin

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(health.router)
app.include_router(products.router)
app.include_router(analysis.router)
app.include_router(compare.router)
app.include_router(auth.router)
app.include_router(userdata.router)
app.include_router(admin.router)
