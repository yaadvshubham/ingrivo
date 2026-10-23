"""Firebase Admin & User Data Service.

Handles:
- OTP generation, storage, expiration, and verification.
- Firebase Admin authentication (ID token verification, custom token generation).
- JWT token fallback if Firebase Admin credentials are not yet configured.
- Firestore synchronization for user preferences, scan history, and saved products.
"""

import os
import time
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
import jwt
import bcrypt

try:
    import firebase_admin
    from firebase_admin import credentials, auth, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False

from app.core.config import settings

logger = logging.getLogger("ingrivo.firebase")

# In-memory OTP storage: email -> { code, expires_at, purpose, attempts }
otp_storage: Dict[str, Dict[str, Any]] = {}

# In-memory store fallback for users, preferences, scans, saved items
memory_users: Dict[str, Dict[str, Any]] = {}
memory_preferences: Dict[str, Dict[str, Any]] = {}
memory_scans: Dict[str, List[Dict[str, Any]]] = {}
memory_saved: Dict[str, Dict[str, Dict[str, Any]]] = {}

_firebase_initialized = False
_firestore_client = None


def get_firestore_client():
    """Returns Firestore client if configured, else None."""
    global _firebase_initialized, _firestore_client
    if not FIREBASE_AVAILABLE:
        return None

    if _firestore_client:
        return _firestore_client

    if not _firebase_initialized:
        try:
            if settings.FIREBASE_CREDENTIALS_PATH and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
                cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
                firebase_admin.initialize_app(cred)
            elif settings.FIREBASE_PROJECT_ID:
                cred = credentials.ApplicationDefault()
                firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
            else:
                # Default initialize if possible
                firebase_admin.initialize_app()
            _firebase_initialized = True
            _firestore_client = firestore.client()
            logger.info("Firebase Admin and Firestore initialized successfully.")
        except Exception as e:
            logger.warning("Firebase Admin initialization skipped or failed: %s", e)
            return None

    return _firestore_client


# ---------------------------------------------------------------------------
# OTP Service
# ---------------------------------------------------------------------------

def generate_otp(email: str, purpose: str = "login", ttl_seconds: int = 600) -> str:
    """Generate a secure 6-digit OTP code and store it with expiration."""
    clean_email = email.strip().lower()
    # 6-digit numeric code
    code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = time.time() + ttl_seconds

    otp_storage[clean_email] = {
        "code": code,
        "expires_at": expires_at,
        "purpose": purpose,
        "attempts": 0,
    }
    return code


def verify_otp(email: str, code: str, purpose: str = "login") -> bool:
    """Verify an OTP code. Invalidate on success or max attempts."""
    clean_email = email.strip().lower()
    record = otp_storage.get(clean_email)
    if not record:
        return False

    if time.time() > record["expires_at"]:
        del otp_storage[clean_email]
        return False

    if record["purpose"] != purpose:
        return False

    record["attempts"] += 1
    if record["attempts"] > 5:
        del otp_storage[clean_email]
        return False

    if record["code"] == code.strip():
        # Valid! Invalidate after single use
        del otp_storage[clean_email]
        return True

    return False


# ---------------------------------------------------------------------------
# Auth Tokens (Firebase Custom Token + JWT fallback)
# ---------------------------------------------------------------------------

def create_access_token(uid: str, email: str, display_name: str | None = None, role: str | None = None) -> str:
    """Create a signed JWT access token for authentication."""
    clean_email = (email or "").strip().lower()
    assigned_role = "admin" if (clean_email == "yaadvshubham01@gmail.com" or role == "admin") else (role or "user")
    payload = {
        "uid": uid,
        "email": email,
        "name": display_name or (email.split("@")[0] if "@" in email else email),
        "role": assigned_role,
        "exp": datetime.now(timezone.utc) + timedelta(days=14),
        "iat": datetime.now(timezone.utc),
        "iss": "ingrivo-auth",
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")
    return token


def verify_auth_token(token: str) -> Optional[Dict[str, Any]]:
    """Verifies a Firebase ID token or Pinfo JWT token."""
    # 1. Try Firebase ID token verification if available
    if FIREBASE_AVAILABLE and _firebase_initialized:
        try:
            decoded = auth.verify_id_token(token)
            clean_email = (decoded.get("email") or "").strip().lower()
            role = "admin" if (clean_email == "yaadvshubham01@gmail.com" or decoded.get("role") == "admin") else "user"
            return {
                "uid": decoded.get("uid"),
                "email": decoded.get("email"),
                "name": decoded.get("name"),
                "picture": decoded.get("picture"),
                "role": role,
            }
        except Exception:
            pass

    # 2. Try JWT fallback
    try:
        decoded = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        clean_email = (decoded.get("email") or "").strip().lower()
        role = "admin" if (clean_email == "yaadvshubham01@gmail.com" or decoded.get("role") == "admin") else decoded.get("role", "user")
        return {
            "uid": decoded.get("uid"),
            "email": decoded.get("email"),
            "name": decoded.get("name"),
            "picture": None,
            "role": role,
        }
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Password Management
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def update_user_password(uid: str, email: str, new_password: str) -> bool:
    """Update user password in Firebase Auth or local memory store."""
    clean_email = email.strip().lower()
    
    # 1. Update in Firebase if active
    if FIREBASE_AVAILABLE and _firebase_initialized:
        try:
            auth.update_user(uid, password=new_password)
            logger.info("Updated password in Firebase Auth for uid=%s", uid)
            return True
        except Exception as e:
            logger.warning("Could not update password in Firebase Auth: %s", e)

    # 2. Update in memory store
    user = memory_users.get(clean_email)
    if user:
        user["hashed_password"] = hash_password(new_password)
        return True
    else:
        # Create user record
        memory_users[clean_email] = {
            "uid": uid,
            "email": clean_email,
            "name": clean_email.split("@")[0],
            "hashed_password": hash_password(new_password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        return True


# ---------------------------------------------------------------------------
# User Data & Preferences (Firestore + Fallback)
# ---------------------------------------------------------------------------

def get_user_preferences(uid: str) -> Dict[str, Any]:
    """Get dietary preferences and allergen alerts for a user."""
    db = get_firestore_client()
    if db:
        try:
            doc = db.collection("users").document(uid).collection("preferences").document("current").get()
            if doc.exists:
                return doc.to_dict() or {}
        except Exception as e:
            logger.warning("Firestore get_user_preferences error: %s", e)

    return memory_preferences.get(uid, {
        "dietary_preferences": [],
        "allergens": [],
        "health_goals": [],
    })


def save_user_preferences(uid: str, preferences: Dict[str, Any]) -> Dict[str, Any]:
    """Save dietary preferences and allergen alerts for a user."""
    data = {
        "dietary_preferences": preferences.get("dietary_preferences", []),
        "allergens": preferences.get("allergens", []),
        "health_goals": preferences.get("health_goals", []),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    db = get_firestore_client()
    if db:
        try:
            db.collection("users").document(uid).collection("preferences").document("current").set(data)
            logger.info("Saved user preferences to Firestore for uid=%s", uid)
        except Exception as e:
            logger.warning("Firestore save_user_preferences error: %s", e)

    memory_preferences[uid] = data
    return data


def add_user_scan(uid: str, scan: Dict[str, Any]) -> Dict[str, Any]:
    """Add a scan to the user's history in Firestore."""
    record = {
        "ref": scan.get("ref", ""),
        "name": scan.get("name") or "Unknown Product",
        "brand": scan.get("brand") or "",
        "image_url": scan.get("image_url") or "",
        "scanned_at": scan.get("scanned_at") or datetime.now(timezone.utc).isoformat(),
    }

    db = get_firestore_client()
    if db:
        try:
            db.collection("users").document(uid).collection("scans").document(record["ref"]).set(record)
        except Exception as e:
            logger.warning("Firestore add_user_scan error: %s", e)

    user_scans = memory_scans.setdefault(uid, [])
    # Evict duplicate and prepend
    user_scans = [s for s in user_scans if s["ref"] != record["ref"]]
    user_scans.insert(0, record)
    memory_scans[uid] = user_scans[:50]
    return record


def get_user_scans(uid: str) -> List[Dict[str, Any]]:
    """Retrieve scan history for a user."""
    db = get_firestore_client()
    if db:
        try:
            docs = (
                db.collection("users")
                .document(uid)
                .collection("scans")
                .order_by("scanned_at", direction=firestore.Query.DESCENDING)
                .limit(50)
                .stream()
            )
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            logger.warning("Firestore get_user_scans error: %s", e)

    return memory_scans.get(uid, [])


def toggle_saved_product(uid: str, product_data: Dict[str, Any]) -> Dict[str, Any]:
    """Save or bookmark a product to favorites in Firestore."""
    ref = product_data.get("ref", "")
    user_saved = memory_saved.setdefault(uid, {})

    db = get_firestore_client()
    if ref in user_saved:
        # Remove
        del user_saved[ref]
        if db:
            try:
                db.collection("users").document(uid).collection("saved").document(ref).delete()
            except Exception as e:
                logger.warning("Firestore delete saved product error: %s", e)
        return {"saved": False, "ref": ref}
    else:
        # Add
        record = {
            "ref": ref,
            "name": product_data.get("name", "Product"),
            "brand": product_data.get("brand", ""),
            "image_url": product_data.get("image_url", ""),
            "saved_at": datetime.now(timezone.utc).isoformat(),
            "notes": product_data.get("notes", ""),
        }
        user_saved[ref] = record
        if db:
            try:
                db.collection("users").document(uid).collection("saved").document(ref).set(record)
            except Exception as e:
                logger.warning("Firestore set saved product error: %s", e)
        return {"saved": True, "product": record}


def get_user_saved_products(uid: str) -> List[Dict[str, Any]]:
    """Retrieve all saved/bookmarked products for a user."""
    db = get_firestore_client()
    if db:
        try:
            docs = (
                db.collection("users")
                .document(uid)
                .collection("saved")
                .order_by("saved_at", direction=firestore.Query.DESCENDING)
                .stream()
            )
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            logger.warning("Firestore get_user_saved_products error: %s", e)

    return list(memory_saved.get(uid, {}).values())
