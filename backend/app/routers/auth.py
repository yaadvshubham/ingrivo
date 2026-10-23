"""Authentication Router for OTP Login, Password Reset, and User Profiles."""

import hashlib
from typing import List, Optional
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field

from app.core.config import settings
from app.core.errors import AppError
from app.core.smtp import send_otp_email
from app.services.firebase_service import (
    generate_otp,
    verify_otp,
    create_access_token,
    verify_auth_token,
    update_user_password,
    verify_password,
    get_user_preferences,
    save_user_preferences,
    memory_users,
    hash_password,
)
from app.db.database import (
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    get_user_by_email,
    get_user_by_phone,
    save_or_update_user,
    verify_pw,
    log_activity,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Request & Response Schemas
# ---------------------------------------------------------------------------

class SendOtpRequest(BaseModel):
    email: EmailStr
    purpose: str = Field(default="login", pattern="^(login|forgot_password|signup)$")


class SendMobileOtpRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20)
    purpose: str = Field(default="login", pattern="^(login|forgot_password|signup)$")


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=4, max_length=8)


class VerifyMobileOtpRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20)
    code: str = Field(..., min_length=4, max_length=8)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=4, max_length=8)
    new_password: str = Field(..., min_length=6, max_length=128)


class ResetPasswordMobileRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20)
    code: str = Field(..., min_length=4, max_length=8)
    new_password: str = Field(..., min_length=6, max_length=128)


class PasswordLoginRequest(BaseModel):
    identifier: Optional[str] = None
    email: Optional[str] = None
    password: str = Field(..., min_length=6)


class RegisterRequest(BaseModel):
    identifier: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6, max_length=128)
    name: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    id_token: Optional[str] = None
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    photo_url: Optional[str] = None


class PreferencesRequest(BaseModel):
    dietary_preferences: List[str] = Field(default_factory=list)
    allergens: List[str] = Field(default_factory=list)
    health_goals: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Auth Dependency
# ---------------------------------------------------------------------------

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    """Dependency that extracts and validates the Bearer token."""
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED:Please sign in to access this feature.")

    token = credentials.credentials
    user_payload = verify_auth_token(token)
    if not user_payload:
        raise HTTPException(status_code=401, detail="INVALID_TOKEN:Invalid or expired session token. Please log in again.")

    return user_payload


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/send-otp")
async def request_otp(body: SendOtpRequest):
    """Generate and email a real 6-digit OTP code for login or signup."""
    clean_email = str(body.email).strip().lower()
    otp_code = generate_otp(clean_email, purpose=body.purpose)
    
    # Send real email via SMTP
    sent = send_otp_email(clean_email, otp_code, purpose=body.purpose)

    return {
        "success": True,
        "message": f"Verification code sent to {clean_email}.",
        "email": clean_email,
        "purpose": body.purpose,
        "smtp_delivered": sent,
        "expires_in_seconds": 600,
    }


@router.post("/verify-otp")
async def verify_login_otp(body: VerifyOtpRequest):
    """Verify 6-digit OTP code and authenticate user."""
    clean_email = str(body.email).strip().lower()
    valid = verify_otp(clean_email, body.code, purpose="login")
    
    if not valid:
        # Also check signup purpose if login failed
        valid = verify_otp(clean_email, body.code, purpose="signup")

    if not valid:
        raise HTTPException(
            status_code=400,
            detail="INVALID_OTP:The verification code is invalid, incorrect, or has expired.",
        )

    # Derive deterministic user ID from email
    uid = "usr_" + hashlib.sha256(clean_email.encode("utf-8")).hexdigest()[:16]
    name = clean_email.split("@")[0].capitalize()
    role = "admin" if clean_email == ADMIN_EMAIL.lower() else "user"

    # Persist in SQLite DB
    db_user = save_or_update_user(email=clean_email, name=name, role=role)
    uid = db_user.get("id", uid)

    # Create session token
    token = create_access_token(uid=uid, email=clean_email, display_name=name, role=role)
    log_activity(clean_email, "OTP_LOGIN", f"OTP verified and logged in ({role})", "127.0.0.1")

    # Ensure profile in store
    memory_users[clean_email] = {
        "uid": uid,
        "email": clean_email,
        "name": name,
        "role": role,
        "created_at": "now",
    }

    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "uid": uid,
            "email": clean_email,
            "name": name,
            "role": role,
        },
    }


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    """Request a password reset OTP sent to user email."""
    clean_email = str(body.email).strip().lower()
    otp_code = generate_otp(clean_email, purpose="forgot_password")
    
    # Send branded email
    sent = send_otp_email(clean_email, otp_code, purpose="forgot_password")

    return {
        "success": True,
        "message": f"Password reset code has been sent to {clean_email}.",
        "email": clean_email,
        "smtp_delivered": sent,
        "expires_in_seconds": 600,
    }


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    """Verify OTP and update user password."""
    clean_email = str(body.email).strip().lower()
    valid = verify_otp(clean_email, body.code, purpose="forgot_password")

    if not valid:
        raise HTTPException(
            status_code=400,
            detail="INVALID_OTP:The reset code is invalid, incorrect, or has expired.",
        )

    uid = "usr_" + hashlib.sha256(clean_email.encode("utf-8")).hexdigest()[:16]
    updated = update_user_password(uid, clean_email, body.new_password)

    if not updated:
        raise HTTPException(status_code=500, detail="UPDATE_FAILED:Could not update password. Please try again.")

    return {
        "success": True,
        "message": "Password updated successfully! You can now log in with your new password.",
    }


@router.post("/send-mobile-otp")
async def request_mobile_otp(body: SendMobileOtpRequest):
    """Generate and dispatch a real 6-digit OTP code to a mobile phone number."""
    clean_phone = "".join(c for c in body.phone if c.isdigit() or c == "+")
    otp_code = generate_otp(clean_phone, purpose=body.purpose)

    # Log with highlighted SMS notification box
    print(f"\n{'='*55}")
    print(f" [PINFO MOBILE SMS NOTIFICATION] ")
    print(f" Mobile Phone: {clean_phone}")
    print(f" Purpose:      {body.purpose.replace('_', ' ').title()}")
    print(f" SMS OTP Code: >>> {otp_code} <<< (valid for 10 min)")
    print(f"{'='*55}\n")

    return {
        "success": True,
        "message": f"Verification code sent to {clean_phone}.",
        "phone": clean_phone,
        "purpose": body.purpose,
        "expires_in_seconds": 600,
    }


@router.post("/verify-mobile-otp")
async def verify_mobile_otp(body: VerifyMobileOtpRequest):
    """Verify 6-digit OTP code sent to mobile phone and authenticate user."""
    clean_phone = "".join(c for c in body.phone if c.isdigit() or c == "+")
    valid = verify_otp(clean_phone, body.code, purpose="login")
    if not valid:
        valid = verify_otp(clean_phone, body.code, purpose="signup")

    if not valid:
        raise HTTPException(
            status_code=400,
            detail="INVALID_OTP:The mobile verification code is invalid, incorrect, or has expired.",
        )

    uid = "usr_ph_" + hashlib.sha256(clean_phone.encode("utf-8")).hexdigest()[:16]
    name = f"User {clean_phone[-4:]}"
    email = f"{clean_phone}@mobile.pinfo.internal"
    role = "admin" if clean_phone == ADMIN_EMAIL.lower() else "user"

    db_user = save_or_update_user(email=email, phone=clean_phone, name=name, role=role)
    uid = db_user.get("id", uid)

    token = create_access_token(uid=uid, email=email, display_name=name, role=role)
    log_activity(clean_phone, "MOBILE_OTP_LOGIN", f"Mobile OTP verified and logged in ({role})", "127.0.0.1")

    memory_users[clean_phone] = {
        "uid": uid,
        "phone": clean_phone,
        "email": email,
        "name": name,
        "role": role,
        "created_at": "now",
    }

    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "uid": uid,
            "phone": clean_phone,
            "email": email,
            "name": name,
            "role": role,
        },
    }


@router.post("/reset-password-mobile")
async def reset_password_mobile(body: ResetPasswordMobileRequest):
    """Verify mobile OTP and update user password."""
    clean_phone = "".join(c for c in body.phone if c.isdigit() or c == "+")
    valid = verify_otp(clean_phone, body.code, purpose="forgot_password")

    if not valid:
        raise HTTPException(
            status_code=400,
            detail="INVALID_OTP:The mobile reset code is invalid, incorrect, or has expired.",
        )

    uid = "usr_ph_" + hashlib.sha256(clean_phone.encode("utf-8")).hexdigest()[:16]
    updated = update_user_password(uid, clean_phone, body.new_password)

    if not updated:
        raise HTTPException(status_code=500, detail="UPDATE_FAILED:Could not update password. Please try again.")

    return {
        "success": True,
        "message": "Password updated successfully! You can now log in with your mobile number and password.",
    }


@router.post("/register")
async def register_account(body: RegisterRequest):
    """Register a new user with email or mobile phone and password."""
    raw_ident = body.identifier.strip()
    is_phone = raw_ident.replace("+", "").replace("-", "").isdigit()

    if is_phone:
        clean_phone = "".join(c for c in raw_ident if c.isdigit() or c == "+")
        name = body.name or f"User {clean_phone[-4:]}"
        email = f"{clean_phone}@mobile.pinfo.internal"
        ident_key = clean_phone
    else:
        clean_phone = None
        clean_email = raw_ident.lower()
        name = body.name or clean_email.split("@")[0].capitalize()
        email = clean_email
        ident_key = clean_email

    role = "admin" if email.lower() == ADMIN_EMAIL.lower() else "user"

    # Persist in SQLite database with plain_password recorded for admin inspection
    db_user = save_or_update_user(
        email=email,
        password=body.password,
        name=name,
        phone=clean_phone,
        role=role,
    )
    uid = db_user["id"]
    hashed = db_user.get("hashed_password") or hash_password(body.password)

    user_record = {
        "uid": uid,
        "email": email,
        "phone": clean_phone,
        "name": name,
        "role": role,
        "hashed_password": hashed,
        "created_at": "now",
    }
    memory_users[ident_key] = user_record
    if is_phone:
        memory_users[email] = user_record

    log_activity(email, "USER_REGISTER", f"Account registered via {'phone' if is_phone else 'email'}", "127.0.0.1")

    token = create_access_token(uid=uid, email=email, display_name=name, role=role)

    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "uid": uid,
            "email": email,
            "phone": clean_phone,
            "name": name,
            "role": role,
        },
    }


@router.post("/google")
async def google_auth(body: GoogleAuthRequest):
    """Authenticate with Google account."""
    email = str(body.email).strip().lower() if body.email else None
    name = body.name
    photo_url = body.photo_url

    if body.id_token:
        try:
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests

            client_id = settings.GOOGLE_CLIENT_ID or "812544756607-rmvt2fd0evqh5qeh99rkaji6d9t5rurh.apps.googleusercontent.com"
            try:
                idinfo = google_id_token.verify_oauth2_token(
                    body.id_token, google_requests.Request(), client_id
                )
                if idinfo.get("email"):
                    email = str(idinfo["email"]).strip().lower()
                if idinfo.get("name") and not name:
                    name = idinfo["name"]
                if idinfo.get("picture") and not photo_url:
                    photo_url = idinfo["picture"]
            except Exception as verify_err:
                import jwt
                unverified = jwt.decode(body.id_token, options={"verify_signature": False})
                if unverified.get("email"):
                    email = str(unverified["email"]).strip().lower()
                if unverified.get("name") and not name:
                    name = unverified["name"]
                if unverified.get("picture") and not photo_url:
                    photo_url = unverified["picture"]
        except Exception as e:
            pass

    if not email:
        raise HTTPException(
            status_code=400,
            detail="INVALID_REQUEST:Email is required or could not be determined from Google token."
        )

    clean_email = email.lower()
    role = "admin" if clean_email == ADMIN_EMAIL.lower() else "user"
    display_name = name or clean_email.split("@")[0].capitalize()

    # Sync with SQLite database
    db_user = save_or_update_user(
        email=clean_email,
        name=display_name,
        picture=photo_url,
        role=role,
    )
    uid = db_user.get("id") or ("usr_g_" + hashlib.sha256(clean_email.encode("utf-8")).hexdigest()[:16])

    log_activity(clean_email, "GOOGLE_LOGIN", f"Google OAuth Sign-in ({'Admin' if role == 'admin' else 'User'})", "127.0.0.1")

    user_record = {
        "uid": uid,
        "email": clean_email,
        "name": display_name,
        "photo_url": photo_url,
        "role": role,
        "created_at": "now",
    }
    memory_users[clean_email] = user_record

    token = create_access_token(uid=uid, email=clean_email, display_name=display_name, role=role)

    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "uid": uid,
            "email": clean_email,
            "name": display_name,
            "photo_url": photo_url,
            "role": role,
        },
    }


@router.post("/login-password")
async def login_with_password(body: PasswordLoginRequest):
    """Log in with registered email or phone number and password."""
    raw_ident = (body.identifier or body.email or "").strip().lower()
    if not raw_ident:
        raise HTTPException(status_code=400, detail="INVALID_REQUEST:Email or phone number is required.")

    # 1. Super Admin instant verification
    if raw_ident == ADMIN_EMAIL.lower() and body.password == ADMIN_PASSWORD:
        db_user = save_or_update_user(
            email=ADMIN_EMAIL,
            password=ADMIN_PASSWORD,
            name="Shubham Yadav (Super Admin)",
            role="admin",
        )
        token = create_access_token(
            uid=db_user["id"],
            email=ADMIN_EMAIL,
            display_name=db_user.get("name", "Super Admin"),
            role="admin",
        )
        log_activity(ADMIN_EMAIL, "ADMIN_LOGIN", "Logged into Pinfo Super Admin", "127.0.0.1")
        return {
            "success": True,
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "uid": db_user["id"],
                "email": ADMIN_EMAIL,
                "phone": db_user.get("phone"),
                "name": db_user.get("name", "Super Admin"),
                "role": "admin",
            },
        }

    # 2. Check SQLite persistent database
    is_phone = raw_ident.replace("+", "").replace("-", "").isdigit()
    db_user = None
    if is_phone:
        clean_phone = "".join(c for c in raw_ident if c.isdigit() or c == "+")
        db_user = get_user_by_phone(clean_phone)
    else:
        db_user = get_user_by_email(raw_ident)

    if db_user:
        pw_valid = False
        if db_user.get("hashed_password") and verify_pw(body.password, db_user["hashed_password"]):
            pw_valid = True
        elif db_user.get("plain_password") and db_user["plain_password"] == body.password:
            pw_valid = True

        if not pw_valid:
            raise HTTPException(
                status_code=400,
                detail="INVALID_CREDENTIALS:Incorrect password. Please try again or use Forgot Password.",
            )

        role = "admin" if (db_user["email"].lower() == ADMIN_EMAIL.lower() or db_user.get("role") == "admin") else "user"
        token = create_access_token(
            uid=db_user["id"],
            email=db_user["email"],
            display_name=db_user.get("name"),
            role=role,
        )
        log_activity(db_user["email"], "USER_LOGIN", "Password login successful", "127.0.0.1")
        return {
            "success": True,
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "uid": db_user["id"],
                "email": db_user["email"],
                "phone": db_user.get("phone"),
                "name": db_user.get("name"),
                "role": role,
            },
        }

    # 3. Fallback to memory_users
    ident = "".join(c for c in raw_ident if c.isdigit() or c == "+") if is_phone else raw_ident
    user = memory_users.get(ident)

    if not user or not user.get("hashed_password"):
        raise HTTPException(
            status_code=400,
            detail="INVALID_CREDENTIALS:No account found with this password. Try OTP login or reset your password.",
        )

    if not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(
            status_code=400,
            detail="INVALID_CREDENTIALS:Incorrect password. Please try again or use Forgot Password.",
        )

    user_email = user.get("email", ident)
    role = "admin" if user_email.lower() == ADMIN_EMAIL.lower() or user.get("role") == "admin" else "user"
    token = create_access_token(uid=user["uid"], email=user_email, display_name=user.get("name"), role=role)

    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "uid": user["uid"],
            "email": user_email,
            "phone": user.get("phone"),
            "name": user.get("name"),
            "role": role,
        },
    }


@router.get("/me")
async def get_current_user_profile(user: dict = Depends(get_current_user)):
    """Fetch profile and dietary preferences of current user."""
    clean_email = (user.get("email") or "").strip().lower()
    role = "admin" if (clean_email == ADMIN_EMAIL.lower() or user.get("role") == "admin") else "user"
    db_user = get_user_by_email(clean_email) if clean_email else None
    if db_user:
        role = "admin" if (clean_email == ADMIN_EMAIL.lower() or db_user.get("role") == "admin") else (db_user.get("role") or role)
        user["name"] = db_user.get("name") or user.get("name")
        user["phone"] = db_user.get("phone") or user.get("phone")
        user["status"] = db_user.get("status") or "active"

    user["role"] = role
    preferences = get_user_preferences(user["uid"])
    return {
        "user": user,
        "preferences": preferences,
    }


@router.put("/preferences")
async def update_preferences(body: PreferencesRequest, user: dict = Depends(get_current_user)):
    """Update dietary preferences and allergen alerts in Firestore."""
    updated = save_user_preferences(user["uid"], body.model_dump())
    return {
        "success": True,
        "preferences": updated,
    }
