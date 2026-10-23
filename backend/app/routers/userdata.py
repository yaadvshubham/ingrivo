"""User Data Router for cloud-synced scan history and saved favorite products."""

from typing import Optional, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.routers.auth import get_current_user
from app.services.firebase_service import (
    add_user_scan,
    get_user_scans,
    toggle_saved_product,
    get_user_saved_products,
)

router = APIRouter(prefix="/api/v1/userdata", tags=["userdata"])


class ScanItemRequest(BaseModel):
    ref: str
    name: Optional[str] = "Unknown Product"
    brand: Optional[str] = ""
    image_url: Optional[str] = None
    scanned_at: Optional[str] = None


class ToggleSavedRequest(BaseModel):
    ref: str
    name: Optional[str] = "Product"
    brand: Optional[str] = ""
    image_url: Optional[str] = None
    notes: Optional[str] = ""


@router.get("/scans")
async def fetch_user_scans(user: dict = Depends(get_current_user)):
    """Get authenticated user's scan history from Firestore."""
    scans = get_user_scans(user["uid"])
    return {
        "success": True,
        "scans": scans,
        "count": len(scans),
    }


@router.post("/scans")
async def record_user_scan(body: ScanItemRequest, user: dict = Depends(get_current_user)):
    """Record a product scan to user's history in Firestore."""
    scan = add_user_scan(user["uid"], body.model_dump())
    return {
        "success": True,
        "scan": scan,
    }


@router.get("/saved")
async def fetch_user_saved(user: dict = Depends(get_current_user)):
    """Get authenticated user's saved/favorite products from Firestore."""
    saved = get_user_saved_products(user["uid"])
    return {
        "success": True,
        "saved": saved,
        "count": len(saved),
    }


@router.post("/saved/toggle")
async def toggle_favorite(body: ToggleSavedRequest, user: dict = Depends(get_current_user)):
    """Add or remove a product from user favorites in Firestore."""
    res = toggle_saved_product(user["uid"], body.model_dump())
    return {
        "success": True,
        **res,
    }
