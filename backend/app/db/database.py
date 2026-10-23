"""Pinfo Persistent SQLite Database Layer.

Provides lightweight, robust, zero-dependency persistence for user accounts,
Google OAuth profiles, audit activity logs, and scan history.
Includes full support for Super Admin management, user credentials inspection,
and role-based permissions.
"""

import os
import json
import sqlite3
import logging
import hashlib
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

import bcrypt

logger = logging.getLogger("pinfo.db")

# Default database directory and path
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
DB_PATH = os.path.join(DB_DIR, "pinfo.db")

ADMIN_EMAIL = "yaadvshubham01@gmail.com"
ADMIN_PASSWORD = "@jaishankar2931"

_db_initialized = False


def get_db_connection() -> sqlite3.Connection:
    """Creates a connection to the SQLite database with row factory enabled."""
    global _db_initialized
    os.makedirs(DB_DIR, exist_ok=True)
    if not os.path.exists(DB_PATH):
        old_db = os.path.join(DB_DIR, "ingrivo.db")
        if os.path.exists(old_db):
            import shutil
            try:
                shutil.copyfile(old_db, DB_PATH)
            except Exception:
                pass
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")  # High concurrency
    if not _db_initialized:
        _db_initialized = True
        try:
            init_db()
        except Exception as e:
            logger.warning("Auto init_db error: %s", e)
    return conn


def hash_pw(password: str) -> str:
    """Hashes a password with bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pw(password: str, hashed: str) -> bool:
    """Verifies a password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _raw_connection() -> sqlite3.Connection:
    os.makedirs(DB_DIR, exist_ok=True)
    if not os.path.exists(DB_PATH):
        old_db = os.path.join(DB_DIR, "ingrivo.db")
        if os.path.exists(old_db):
            import shutil
            try:
                shutil.copyfile(old_db, DB_PATH)
            except Exception:
                pass
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


def init_db() -> None:
    """Initializes the database schema, runs column migrations, and seeds admin."""
    global _db_initialized
    _db_initialized = True
    with _raw_connection() as conn:
        cursor = conn.cursor()

        # 1. Users Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                google_sub TEXT UNIQUE,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                email_verified INTEGER DEFAULT 0,
                name TEXT,
                picture TEXT,
                hashed_password TEXT,
                plain_password TEXT,
                role TEXT DEFAULT 'user',
                status TEXT DEFAULT 'active',
                dietary_preferences TEXT,
                allergens TEXT,
                health_goals TEXT,
                scans_count INTEGER DEFAULT 0,
                last_login TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);")

        # Column migrations for existing databases
        cursor.execute("PRAGMA table_info(users);")
        existing_cols = {row["name"] for row in cursor.fetchall()}
        
        migration_cols = {
            "phone": "TEXT",
            "plain_password": "TEXT",
            "role": "TEXT DEFAULT 'user'",
            "status": "TEXT DEFAULT 'active'",
            "dietary_preferences": "TEXT",
            "allergens": "TEXT",
            "health_goals": "TEXT",
            "scans_count": "INTEGER DEFAULT 0",
            "last_login": "TEXT",
        }
        for col_name, col_type in migration_cols.items():
            if col_name not in existing_cols:
                try:
                    cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type};")
                    logger.info("Migrated users table: added column %s", col_name)
                except Exception as e:
                    logger.warning("Could not add column %s: %s", col_name, e)

        # 2. Activity Logs Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT,
                action TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                timestamp TEXT NOT NULL
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON activity_logs(timestamp);")

        # 3. Scans History Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scans_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                product_code TEXT,
                product_name TEXT,
                brand TEXT,
                grade TEXT,
                timestamp TEXT NOT NULL
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_scans_user ON scans_history(user_email);")

        conn.commit()

    logger.info("Initialized Pinfo SQLite database at %s", DB_PATH)

    # Seed Admin User only
    seed_admin_user()
    clean_dummy_data()


def clean_dummy_data() -> None:
    """Removes any previous sample/dummy records so only real user data is displayed."""
    dummy_emails = [
        "rohit.sharma@healthfit.in",
        "priya.patel@gmail.com",
        "vikram.mehta@outlook.com",
        "ananya.sen@gmail.com",
        "neha.verma@yahoo.com",
        "testuser@gmail.com",
        "regular.user@example.com",
    ]
    try:
        with _raw_connection() as conn:
            cursor = conn.cursor()
            for email in dummy_emails:
                cursor.execute("DELETE FROM users WHERE LOWER(email) = ?", (email.lower(),))
                cursor.execute("DELETE FROM scans_history WHERE LOWER(user_email) = ?", (email.lower(),))
                cursor.execute("DELETE FROM activity_logs WHERE LOWER(user_email) = ?", (email.lower(),))
            conn.commit()
    except Exception as e:
        logger.warning("Could not clean dummy data: %s", e)


def seed_admin_user() -> None:
    """Ensures the Super Admin account (yaadvshubham01@gmail.com) exists with role='admin'."""
    now_iso = datetime.now(timezone.utc).isoformat()
    clean_email = ADMIN_EMAIL.strip().lower()

    with _raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (clean_email,))
        existing = cursor.fetchone()

        hashed = hash_pw(ADMIN_PASSWORD)

        if not existing:
            admin_id = "usr_admin_01"
            cursor.execute("""
                INSERT INTO users (
                    id, email, name, role, status, hashed_password, plain_password,
                    email_verified, dietary_preferences, allergens, health_goals,
                    scans_count, last_login, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, ?, ?, ?)
            """, (
                admin_id,
                clean_email,
                "Shubham Yadav (Super Admin)",
                "admin",
                "active",
                hashed,
                ADMIN_PASSWORD,
                json.dumps([]),
                json.dumps([]),
                json.dumps([]),
                now_iso,
                now_iso,
                now_iso,
            ))
            cursor.execute("""
                INSERT INTO activity_logs (user_email, action, details, ip_address, timestamp)
                VALUES (?, 'SYSTEM_INIT', 'Super Admin account provisioned', '127.0.0.1', ?)
            """, (clean_email, now_iso))
            conn.commit()
            logger.info("Seeded Super Admin user: %s", clean_email)
        else:
            # Update password and role to ensure admin integrity
            cursor.execute("""
                UPDATE users
                SET role = 'admin',
                    hashed_password = ?,
                    plain_password = ?,
                    status = 'active',
                    updated_at = ?
                WHERE email = ?
            """, (hashed, ADMIN_PASSWORD, now_iso, clean_email))
            conn.commit()


# ---------------------------------------------------------------------------
# User Query Functions
# ---------------------------------------------------------------------------

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve user record by internal user ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Retrieve user record by lowercase email address."""
    clean_email = email.strip().lower()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (clean_email,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_phone(phone: str) -> Optional[Dict[str, Any]]:
    """Retrieve user record by phone number."""
    clean_phone = "".join(c for c in phone if c.isdigit() or c == "+")
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE phone = ?", (clean_phone,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_google_sub(google_sub: str) -> Optional[Dict[str, Any]]:
    """Retrieve user record by Google sub."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE google_sub = ?", (google_sub,))
        row = cursor.fetchone()
        return dict(row) if row else None


def save_or_update_user(
    email: str,
    password: Optional[str] = None,
    name: Optional[str] = None,
    phone: Optional[str] = None,
    google_sub: Optional[str] = None,
    picture: Optional[str] = None,
    role: Optional[str] = None,
) -> Dict[str, Any]:
    """Saves or updates a user in the SQLite database, ensuring yaadvshubham01@gmail.com is always Admin."""
    clean_email = email.strip().lower()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Admin Rule enforcement
    if clean_email == ADMIN_EMAIL.lower():
        assigned_role = "admin"
    else:
        assigned_role = role or "user"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (clean_email,))
        existing = cursor.fetchone()

        hashed = hash_pw(password) if password else (existing["hashed_password"] if existing else None)
        plain = password if password else (existing["plain_password"] if existing else None)

        if existing:
            user_id = existing["id"]
            cursor.execute("""
                UPDATE users
                SET name = COALESCE(?, name),
                    phone = COALESCE(?, phone),
                    google_sub = COALESCE(?, google_sub),
                    picture = COALESCE(?, picture),
                    hashed_password = COALESCE(?, hashed_password),
                    plain_password = COALESCE(?, plain_password),
                    role = ?,
                    last_login = ?,
                    updated_at = ?
                WHERE id = ?
            """, (
                name,
                phone,
                google_sub,
                picture,
                hashed,
                plain,
                assigned_role,
                now_iso,
                now_iso,
                user_id,
            ))
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            return dict(cursor.fetchone())
        else:
            import uuid
            user_id = f"usr_{uuid.uuid4().hex[:14]}"
            display_name = name or clean_email.split("@")[0].capitalize()
            cursor.execute("""
                INSERT INTO users (
                    id, email, phone, google_sub, name, picture,
                    hashed_password, plain_password, role, status,
                    email_verified, last_login, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)
            """, (
                user_id,
                clean_email,
                phone,
                google_sub,
                display_name,
                picture,
                hashed,
                plain,
                assigned_role,
                now_iso,
                now_iso,
                now_iso,
            ))
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            return dict(cursor.fetchone())


def record_user_scan(user_email: str, product_code: str, product_name: str, brand: str = "", grade: str = "") -> None:
    """Logs a scan in scans_history and increments user's scans_count."""
    clean_email = user_email.strip().lower()
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO scans_history (user_email, product_code, product_name, brand, grade, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (clean_email, product_code, product_name, brand, grade, now_iso))
        cursor.execute("UPDATE users SET scans_count = scans_count + 1 WHERE email = ?", (clean_email,))
        conn.commit()


def log_activity(user_email: str, action: str, details: str = "", ip_address: str = "127.0.0.1") -> None:
    """Logs an action to activity_logs table."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO activity_logs (user_email, action, details, ip_address, timestamp)
                VALUES (?, ?, ?, ?, ?)
            """, (user_email.strip().lower(), action, details, ip_address, now_iso))
            conn.commit()
    except Exception as e:
        logger.warning("Could not record activity log: %s", e)


# ---------------------------------------------------------------------------
# Admin Dashboard Queries
# ---------------------------------------------------------------------------

def get_all_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> Dict[str, Any]:
    """Fetch paginated users with credentials and scan stats for Admin viewing."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM users WHERE 1=1"
        params: List[Any] = []

        if search:
            s = f"%{search.strip().lower()}%"
            query += " AND (LOWER(email) LIKE ? OR LOWER(name) LIKE ? OR phone LIKE ?)"
            params.extend([s, s, s])

        if role and role != "all":
            query += " AND role = ?"
            params.append(role)

        if status and status != "all":
            query += " AND status = ?"
            params.append(status)

        # Count total
        count_query = query.replace("SELECT * FROM users", "SELECT COUNT(*) as total FROM users")
        cursor.execute(count_query, params)
        total_count = cursor.fetchone()["total"]

        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor.execute(query, params)
        rows = cursor.fetchall()

        users = []
        for r in rows:
            u = dict(r)
            # Parse json fields safely
            try:
                u["dietary_preferences"] = json.loads(u["dietary_preferences"]) if u["dietary_preferences"] else []
            except Exception:
                u["dietary_preferences"] = []
            try:
                u["allergens"] = json.loads(u["allergens"]) if u["allergens"] else []
            except Exception:
                u["allergens"] = []
            try:
                u["health_goals"] = json.loads(u["health_goals"]) if u["health_goals"] else []
            except Exception:
                u["health_goals"] = []
            users.append(u)

        return {"total": total_count, "users": users}


def get_user_detail_for_admin(user_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve full user profile, recent scans, and audit logs for the admin modal."""
    user = get_user_by_id(user_id)
    if not user:
        return None

    clean_email = user["email"].strip().lower()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Recent scans
        cursor.execute("""
            SELECT * FROM scans_history WHERE user_email = ? ORDER BY timestamp DESC LIMIT 10
        """, (clean_email,))
        scans = [dict(r) for r in cursor.fetchall()]

        # Recent logs
        cursor.execute("""
            SELECT * FROM activity_logs WHERE user_email = ? ORDER BY timestamp DESC LIMIT 15
        """, (clean_email,))
        logs = [dict(r) for r in cursor.fetchall()]

        user["recent_scans"] = scans
        user["recent_activity"] = logs
        return user


def admin_update_user(user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Allows Super Admin to update user role, status, password, or contact."""
    user = get_user_by_id(user_id)
    if not user:
        return None

    clean_email = user["email"].strip().lower()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Prevent demoting the primary Super Admin
    if clean_email == ADMIN_EMAIL.lower() and updates.get("role") and updates["role"] != "admin":
        updates["role"] = "admin"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        fields = []
        params = []

        if "name" in updates:
            fields.append("name = ?")
            params.append(updates["name"])

        if "phone" in updates:
            fields.append("phone = ?")
            params.append(updates["phone"])

        if "role" in updates:
            fields.append("role = ?")
            params.append(updates["role"])

        if "status" in updates:
            fields.append("status = ?")
            params.append(updates["status"])

        if "password" in updates and updates["password"]:
            new_pw = updates["password"]
            fields.append("hashed_password = ?")
            params.append(hash_pw(new_pw))
            fields.append("plain_password = ?")
            params.append(new_pw)

        if not fields:
            return user

        fields.append("updated_at = ?")
        params.append(now_iso)

        params.append(user_id)
        cursor.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", params)
        conn.commit()

        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        return dict(cursor.fetchone())


def admin_delete_user(user_id: str) -> bool:
    """Deletes a user account. Safeguards yaadvshubham01@gmail.com from deletion."""
    user = get_user_by_id(user_id)
    if not user:
        return False
    if user["email"].strip().lower() == ADMIN_EMAIL.lower():
        logger.warning("Attempted to delete primary Super Admin account rejected.")
        return False

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        cursor.execute("DELETE FROM scans_history WHERE user_email = ?", (user["email"],))
        cursor.execute("DELETE FROM activity_logs WHERE user_email = ?", (user["email"],))
        conn.commit()
        return True


def get_admin_overview_stats() -> Dict[str, Any]:
    """Generates real-time platform statistics for the Admin Overview dashboard."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) as total_users FROM users;")
        total_users = cursor.fetchone()["total_users"]

        cursor.execute("SELECT COUNT(*) as admin_users FROM users WHERE role = 'admin';")
        admin_users = cursor.fetchone()["admin_users"]

        cursor.execute("SELECT COUNT(*) as active_users FROM users WHERE status = 'active';")
        active_users = cursor.fetchone()["active_users"]

        cursor.execute("SELECT COUNT(*) as suspended_users FROM users WHERE status = 'suspended';")
        suspended_users = cursor.fetchone()["suspended_users"]

        cursor.execute("SELECT COUNT(*) as total_scans FROM scans_history;")
        total_scans = cursor.fetchone()["total_scans"]

        # Scans grade distribution
        cursor.execute("""
            SELECT grade, COUNT(*) as count FROM scans_history WHERE grade IS NOT NULL AND grade != '' GROUP BY grade ORDER BY grade ASC;
        """)
        grade_rows = cursor.fetchall()
        grade_distribution = {r["grade"]: r["count"] for r in grade_rows}

        # User dietary preferences & allergens breakdown
        cursor.execute("SELECT dietary_preferences, allergens FROM users;")
        user_rows = cursor.fetchall()
        dietary_counts: Dict[str, int] = {}
        allergen_counts: Dict[str, int] = {}

        for r in user_rows:
            if r["dietary_preferences"]:
                try:
                    d_list = json.loads(r["dietary_preferences"])
                    for d in d_list:
                        dietary_counts[d] = dietary_counts.get(d, 0) + 1
                except Exception:
                    pass
            if r["allergens"]:
                try:
                    a_list = json.loads(r["allergens"])
                    for a in a_list:
                        allergen_counts[a] = allergen_counts.get(a, 0) + 1
                except Exception:
                    pass

        cursor.execute("""
            SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 20;
        """)
        recent_logs = [dict(r) for r in cursor.fetchall()]

        # File size of SQLite DB
        db_size_bytes = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0

        return {
            "total_users": total_users,
            "admin_users": admin_users,
            "active_users": active_users,
            "suspended_users": suspended_users,
            "total_scans": total_scans,
            "grade_distribution": grade_distribution,
            "dietary_counts": dietary_counts,
            "allergen_counts": allergen_counts,
            "db_size_bytes": db_size_bytes,
            "db_path": DB_PATH,
            "super_admin": ADMIN_EMAIL,
            "system_status": "operational",
            "recent_logs": recent_logs,
        }


def get_admin_logs(search: Optional[str] = None, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
    """Retrieve paginated activity logs for Admin auditing."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM activity_logs WHERE 1=1"
        params: List[Any] = []

        if search:
            s = f"%{search.strip().lower()}%"
            query += " AND (LOWER(user_email) LIKE ? OR LOWER(action) LIKE ? OR LOWER(details) LIKE ?)"
            params.extend([s, s, s])

        count_query = query.replace("SELECT * FROM activity_logs", "SELECT COUNT(*) as total FROM activity_logs")
        cursor.execute(count_query, params)
        total = cursor.fetchone()["total"]

        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor.execute(query, params)
        rows = [dict(r) for r in cursor.fetchall()]
        return {"total": total, "logs": rows}


def get_admin_scans(search: Optional[str] = None, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
    """Retrieve paginated scan history records for Admin inspection."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM scans_history WHERE 1=1"
        params: List[Any] = []

        if search:
            s = f"%{search.strip().lower()}%"
            query += " AND (LOWER(user_email) LIKE ? OR LOWER(product_name) LIKE ? OR LOWER(brand) LIKE ? OR product_code LIKE ?)"
            params.extend([s, s, s, s])

        count_query = query.replace("SELECT * FROM scans_history", "SELECT COUNT(*) as total FROM scans_history")
        cursor.execute(count_query, params)
        total = cursor.fetchone()["total"]

        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor.execute(query, params)
        rows = [dict(r) for r in cursor.fetchall()]
        return {"total": total, "scans": rows}


def admin_create_user(data: Dict[str, Any]) -> Dict[str, Any]:
    """Manually creates a new user via Admin Panel."""
    email = data.get("email", "").strip().lower()
    if not email:
        raise ValueError("Email is required")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            raise ValueError(f"User with email {email} already exists")

    import uuid
    user_id = f"usr_{uuid.uuid4().hex[:14]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    password = data.get("password") or "Pinfo@2026"
    name = data.get("name") or email.split("@")[0].capitalize()
    phone = data.get("phone")
    role = data.get("role", "user")
    status = data.get("status", "active")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (
                id, email, phone, name, role, status, hashed_password, plain_password,
                email_verified, dietary_preferences, allergens, health_goals,
                scans_count, last_login, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, ?, ?, ?)
        """, (
            user_id,
            email,
            phone,
            name,
            role,
            status,
            hash_pw(password),
            password,
            json.dumps(data.get("dietary_preferences", [])),
            json.dumps(data.get("allergens", [])),
            json.dumps(data.get("health_goals", [])),
            now_iso,
            now_iso,
            now_iso,
        ))
        cursor.execute("""
            INSERT INTO activity_logs (user_email, action, details, ip_address, timestamp)
            VALUES (?, 'ADMIN_USER_CREATED', 'Account created manually by Super Admin', '127.0.0.1', ?)
        """, (email, now_iso))
        conn.commit()

        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        return dict(cursor.fetchone())

