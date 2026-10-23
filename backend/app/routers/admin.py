"""Admin Router — Super Admin Control Panel Endpoints.

Provides administrative control over users, credentials visibility, activity audit logs,
product scans intelligence, and platform metrics.
Strictly guarded by require_admin_user dependency.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel, EmailStr, Field

from app.routers.auth import get_current_user
from app.db.database import (
    ADMIN_EMAIL,
    get_admin_overview_stats,
    get_all_users,
    get_user_detail_for_admin,
    admin_update_user,
    admin_delete_user,
    admin_create_user,
    get_admin_logs,
    get_admin_scans,
    log_activity,
    export_snapshot,
    restore_from_snapshot,
    DB_PATH,
    DB_DIR,
    SNAPSHOT_PATH,
)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Admin Security Dependency
# ---------------------------------------------------------------------------

async def require_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Ensures caller has Super Admin privileges. Only yaadvshubham01@gmail.com or role='admin' allowed."""
    email = (current_user.get("email") or "").strip().lower()
    role = current_user.get("role", "user")

    if email != ADMIN_EMAIL.lower() and role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN:Admin privileges required. Your account is not authorized to access the Super Admin Panel.",
        )
    return current_user


# ---------------------------------------------------------------------------
# Request & Response Schemas
# ---------------------------------------------------------------------------

class AdminCreateUserRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = Field(default="Pinfo@2026", min_length=6)
    role: str = Field(default="user", pattern="^(user|admin)$")
    status: str = Field(default="active", pattern="^(active|suspended|pending)$")
    dietary_preferences: List[str] = Field(default_factory=list)
    allergens: List[str] = Field(default_factory=list)
    health_goals: List[str] = Field(default_factory=list)


class AdminUpdateUserRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=6)
    role: Optional[str] = Field(default=None, pattern="^(user|admin)$")
    status: Optional[str] = Field(default=None, pattern="^(active|suspended|pending)$")


class AdminStatusToggleRequest(BaseModel):
    status: str = Field(..., pattern="^(active|suspended)$")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats(admin: dict = Depends(require_admin_user)):
    """Fetch high-level platform statistics, user metrics, and activity logs."""
    stats = get_admin_overview_stats()
    return {
        "success": True,
        "data": stats,
    }


@router.get("/users")
async def list_users(
    search: Optional[str] = Query(None, description="Search by name, email, or phone"),
    role: Optional[str] = Query(None, description="Filter by role ('admin', 'user', 'all')"),
    status: Optional[str] = Query(None, description="Filter by status ('active', 'suspended', 'all')"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(require_admin_user),
):
    """Retrieve all registered users with plain passwords, roles, and status for Super Admin."""
    result = get_all_users(search=search, role=role, status=status, limit=limit, offset=offset)
    return {
        "success": True,
        "total": result["total"],
        "users": result["users"],
    }


@router.get("/users/{user_id}")
async def get_user_detail(user_id: str, admin: dict = Depends(require_admin_user)):
    """Retrieve full user profile, recent scans, and activity logs."""
    user = get_user_detail_for_admin(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND:User not found.")
    return {
        "success": True,
        "user": user,
    }


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(body: AdminCreateUserRequest, admin: dict = Depends(require_admin_user)):
    """Create a new user directly from Admin Panel."""
    try:
        new_user = admin_create_user(body.model_dump())
        log_activity(
            admin.get("email", ADMIN_EMAIL),
            "ADMIN_USER_CREATE",
            f"Created user {body.email} with role={body.role}",
            "127.0.0.1",
        )
        return {
            "success": True,
            "message": f"User {body.email} created successfully.",
            "user": new_user,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"INVALID_DATA:{str(e)}")


@router.put("/users/{user_id}")
async def update_user(user_id: str, body: AdminUpdateUserRequest, admin: dict = Depends(require_admin_user)):
    """Update user information, role, status, or password."""
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="NO_UPDATES:No fields provided to update.")

    updated_user = admin_update_user(user_id, updates)
    if not updated_user:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND:User not found.")

    log_activity(
        admin.get("email", ADMIN_EMAIL),
        "ADMIN_USER_UPDATE",
        f"Updated user ID {user_id}: {list(updates.keys())}",
        "127.0.0.1",
    )

    return {
        "success": True,
        "message": "User updated successfully.",
        "user": updated_user,
    }


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin_user)):
    """Permanently delete a user account and associated history (safeguards Super Admin)."""
    success = admin_delete_user(user_id)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="DELETE_FAILED:Cannot delete this account. It may not exist or is the primary Super Admin account.",
        )

    log_activity(
        admin.get("email", ADMIN_EMAIL),
        "ADMIN_USER_DELETE",
        f"Deleted user ID {user_id}",
        "127.0.0.1",
    )

    return {
        "success": True,
        "message": f"User {user_id} and associated records deleted.",
    }


@router.post("/users/{user_id}/status")
async def toggle_user_status(user_id: str, body: AdminStatusToggleRequest, admin: dict = Depends(require_admin_user)):
    """Quickly toggle user account between active and suspended."""
    updated_user = admin_update_user(user_id, {"status": body.status})
    if not updated_user:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND:User not found.")

    log_activity(
        admin.get("email", ADMIN_EMAIL),
        "ADMIN_STATUS_CHANGE",
        f"Changed status of user {user_id} to {body.status}",
        "127.0.0.1",
    )

    return {
        "success": True,
        "message": f"User status updated to {body.status}.",
        "user": updated_user,
    }


@router.get("/logs")
async def list_audit_logs(
    search: Optional[str] = Query(None, description="Search logs by email, action, details"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(require_admin_user),
):
    """Retrieve system activity audit logs."""
    logs_data = get_admin_logs(search=search, limit=limit, offset=offset)
    return {
        "success": True,
        "total": logs_data["total"],
        "logs": logs_data["logs"],
    }


@router.get("/scans")
async def list_scans(
    search: Optional[str] = Query(None, description="Search scans by user, product, barcode"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(require_admin_user),
):
    """Retrieve scans history across the platform."""
    scans_data = get_admin_scans(search=search, limit=limit, offset=offset)
    return {
        "success": True,
        "total": scans_data["total"],
        "scans": scans_data["scans"],
    }


class AdminRestoreRequest(BaseModel):
    snapshot: Dict[str, Any]


@router.get("/database/export")
async def export_database_snapshot(admin: dict = Depends(require_admin_user)):
    """Exports full database snapshot with all users, passwords, sessions, scans, and audit logs."""
    data = export_snapshot()
    log_activity(admin.get("email", ADMIN_EMAIL), "ADMIN_DB_EXPORT", "Exported database snapshot JSON", "127.0.0.1")
    return {
        "success": True,
        "exported_at": data.get("exported_at"),
        "snapshot": data,
    }


@router.post("/database/restore")
async def restore_database_snapshot(body: AdminRestoreRequest, admin: dict = Depends(require_admin_user)):
    """Restores database from a snapshot JSON payload."""
    if not body.snapshot or not isinstance(body.snapshot, dict):
        raise HTTPException(status_code=400, detail="INVALID_SNAPSHOT:Valid snapshot dictionary is required.")

    result = restore_from_snapshot(body.snapshot)
    log_activity(
        admin.get("email", ADMIN_EMAIL),
        "ADMIN_DB_RESTORE",
        f"Restored database: {result.get('users_restored', 0)} users, {result.get('scans_restored', 0)} scans",
        "127.0.0.1",
    )
    return {
        "success": True,
        "message": f"Database restored successfully ({result.get('users_restored', 0)} users, {result.get('scans_restored', 0)} scans, {result.get('logs_restored', 0)} logs).",
        "result": result,
    }


@router.get("/database/diagnostics")
async def get_database_diagnostics(admin: dict = Depends(require_admin_user)):
    """Provides storage diagnostics, disk persistence mode, and snapshot status."""
    import os
    db_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
    snapshot_exists = os.path.exists(SNAPSHOT_PATH)
    snapshot_size = os.path.getsize(SNAPSHOT_PATH) if snapshot_exists else 0
    snapshot_mtime = os.path.getmtime(SNAPSHOT_PATH) if snapshot_exists else None

    return {
        "success": True,
        "diagnostics": {
            "db_path": DB_PATH,
            "db_dir": DB_DIR,
            "db_size_bytes": db_size,
            "journal_mode": "WAL",
            "snapshot_path": SNAPSHOT_PATH,
            "snapshot_exists": snapshot_exists,
            "snapshot_size_bytes": snapshot_size,
            "snapshot_last_modified": snapshot_mtime,
            "is_persistent_mount": os.path.exists("/var/data") or bool(os.getenv("PERSISTENT_DATA_DIR")),
        }
    }

