"""User Data Router for cloud-synced scan history, saved favorite products, and live activity tracking."""

from typing import Optional, List
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.routers.auth import get_current_user
from app.services.firebase_service import (
    add_user_scan,
    get_user_scans,
    toggle_saved_product,
    get_user_saved_products,
)
from app.db.database import (
    record_user_scan as db_record_user_scan,
    log_activity,
)

router = APIRouter(prefix="/api/v1/userdata", tags=["userdata"])


class ScanItemRequest(BaseModel):
    ref: str
    name: Optional[str] = "Unknown Product"
    brand: Optional[str] = ""
    image_url: Optional[str] = None
    scanned_at: Optional[str] = None
    grade: Optional[str] = None


class ToggleSavedRequest(BaseModel):
    ref: str
    name: Optional[str] = "Product"
    brand: Optional[str] = ""
    image_url: Optional[str] = None
    notes: Optional[str] = ""


class LogActivityRequest(BaseModel):
    action: str
    details: Optional[str] = ""


@router.get("/scans")
async def fetch_user_scans(user: dict = Depends(get_current_user)):
    """Get authenticated user's scan history."""
    scans = get_user_scans(user["uid"])
    return {
        "success": True,
        "scans": scans,
        "count": len(scans),
    }


@router.post("/scans")
async def record_user_scan(body: ScanItemRequest, request: Request, user: dict = Depends(get_current_user)):
    """Record a product scan to user's history and platform live scan feed."""
    user_email = user.get("email") or "consumer@pinfo.app"
    
    # 1. Log to persistent database
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "127.0.0.1")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
        
    try:
        db_record_user_scan(
            user_email=user_email,
            product_code=body.ref,
            product_name=body.name or "Unknown Product",
            brand=body.brand or "",
            grade=body.grade or "",
        )
        log_activity(
            user_email=user_email,
            action="PRODUCT_SCAN",
            details=f"Scanned {body.name or body.ref} ({body.brand or 'General'})",
            ip_address=client_ip,
        )
    except Exception as e:
        pass

    # 2. Add to in-memory / Firestore fallback
    scan = add_user_scan(user["uid"], body.model_dump())
    return {
        "success": True,
        "scan": scan,
    }


@router.post("/activity")
async def record_user_activity(body: LogActivityRequest, request: Request, user: dict = Depends(get_current_user)):
    """Record real-time user activity (searches, AI chats, comparisons) for Admin Audit Trail."""
    user_email = user.get("email") or "consumer@pinfo.app"
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "127.0.0.1")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
        
    try:
        log_activity(
            user_email=user_email,
            action=body.action,
            details=body.details or "",
            ip_address=client_ip,
        )
    except Exception:
        pass

    return {"success": True}


@router.get("/saved")
async def fetch_user_saved(user: dict = Depends(get_current_user)):
    """Get authenticated user's saved/favorite products."""
    saved = get_user_saved_products(user["uid"])
    return {
        "success": True,
        "saved": saved,
        "count": len(saved),
    }


@router.post("/saved/toggle")
async def toggle_favorite(body: ToggleSavedRequest, user: dict = Depends(get_current_user)):
    """Add or remove a product from user favorites."""
    res = toggle_saved_product(user["uid"], body.model_dump())
    return {
        "success": True,
        **res,
    }
