"""Pinfo Dual-Engine Cloud Persistence Layer.

Provides high-reliability persistence supporting both Cloud PostgreSQL
(Render PostgreSQL, Neon, Supabase) for zero-data-loss production hosting
and local SQLite WAL mode for development and offline fallback.

Includes automatic schema initialization, column migrations, Super Admin
credential protection, user session tracking, audit logging, and automated
snapshot auto-recovery.
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

# ---------------------------------------------------------------------------
# Cloud PostgreSQL & Storage Engine Configuration
# ---------------------------------------------------------------------------

POSTGRES_URI = (
    os.environ.get("DATABASE_URL")
    or os.environ.get("POSTGRES_URL")
    or os.environ.get("SUPABASE_DATABASE_URL")
    or os.environ.get("POSTGRESQL_URL")
)

# Persistent storage directory detection (Render Persistent Disk, Custom Env, or local fallback)
_env_dir = os.environ.get("PERSISTENT_DATA_DIR") or os.environ.get("DATA_DIR")
if _env_dir and os.path.exists(_env_dir):
    DB_DIR = _env_dir
elif os.path.isdir("/var/data") and os.access("/var/data", os.W_OK):
    DB_DIR = "/var/data"
else:
    DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

DB_PATH = os.path.join(DB_DIR, "pinfo.db")
SNAPSHOT_PATH = os.path.join(DB_DIR, "pinfo_snapshot.json")

ADMIN_EMAIL = "yaadvshubham01@gmail.com"
ADMIN_PASSWORD = "@jaishankar2931"

_db_initialized = False
_active_engine = "sqlite"  # 'postgres' or 'sqlite'


def is_postgres_configured() -> bool:
    """Returns True if a valid PostgreSQL connection string is provided in the environment."""
    return bool(POSTGRES_URI and POSTGRES_URI.strip())


def is_postgres_active() -> bool:
    """Returns True if the current active database engine is Cloud PostgreSQL."""
    return _active_engine == "postgres"


# ---------------------------------------------------------------------------
# Password Helpers
# ---------------------------------------------------------------------------

def hash_pw(password: str) -> str:
    """Hashes a password with bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pw(password: str, hashed: str) -> bool:
    """Verifies a password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ---------------------------------------------------------------------------
# PostgreSQL Compatibility Wrappers
# ---------------------------------------------------------------------------

class PostgresCursorWrapper:
    """Adapts a psycopg2 cursor to SQLite-style '?' placeholders and dict row access."""

    def __init__(self, cursor):
        self._cur = cursor

    def execute(self, query: str, params=None):
        # Convert SQLite '?' placeholders to PostgreSQL '%s'
        pg_query = query.replace("?", "%s")
        if params is not None:
            if isinstance(params, list):
                params = tuple(params)
            return self._cur.execute(pg_query, params)
        return self._cur.execute(pg_query)

    def fetchone(self) -> Optional[Dict[str, Any]]:
        row = self._cur.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self) -> List[Dict[str, Any]]:
        rows = self._cur.fetchall()
        return [dict(r) for r in rows] if rows else []

    def __iter__(self):
        for r in self._cur:
            yield dict(r)

    def close(self):
        try:
            self._cur.close()
        except Exception:
            pass

    @property
    def rowcount(self):
        return self._cur.rowcount


class PostgresConnectionWrapper:
    """Context manager wrapper around psycopg2 connection."""

    def __init__(self, conn):
        self._conn = conn

    def cursor(self) -> PostgresCursorWrapper:
        import psycopg2.extras
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        return PostgresCursorWrapper(cur)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        try:
            self._conn.close()
        except Exception:
            pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type:
                self._conn.rollback()
            else:
                self._conn.commit()
        finally:
            self.close()


class SqliteConnectionWrapper:
    """Context manager wrapper around sqlite3 connection ensuring commit & close on exit."""

    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def cursor(self):
        return self._conn.cursor()

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        try:
            self._conn.close()
        except Exception:
            pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type:
                self._conn.rollback()
            else:
                self._conn.commit()
        finally:
            self.close()


# ---------------------------------------------------------------------------
# Database Connection Dispatcher
# ---------------------------------------------------------------------------

def _get_pg_connection() -> PostgresConnectionWrapper:
    """Establishes connection to Cloud PostgreSQL (Render / Neon / Supabase)."""
    import psycopg2
    uri = POSTGRES_URI.strip()
    if uri.startswith("postgres://"):
        uri = "postgresql://" + uri[len("postgres://"):]
    conn = psycopg2.connect(uri, connect_timeout=15)
    conn.autocommit = False
    return PostgresConnectionWrapper(conn)


def _get_sqlite_connection() -> SqliteConnectionWrapper:
    """Establishes connection to local SQLite database with WAL mode."""
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
    return SqliteConnectionWrapper(conn)


def get_db_connection():
    """Returns an active database connection wrapper for either PostgreSQL or SQLite."""
    global _db_initialized, _active_engine

    if is_postgres_configured():
        try:
            conn = _get_pg_connection()
            _active_engine = "postgres"
            if not _db_initialized:
                _db_initialized = True
                try:
                    init_db()
                except Exception as e:
                    logger.warning("PostgreSQL init_db warning: %s", e)
            return conn
        except Exception as e:
            logger.error("Cloud PostgreSQL connection failed: %s. Falling back to local SQLite.", e)

    _active_engine = "sqlite"
    conn = _get_sqlite_connection()
    if not _db_initialized:
        _db_initialized = True
        try:
            init_db()
        except Exception as e:
            logger.warning("SQLite init_db warning: %s", e)
    return conn


def _raw_connection():
    """Direct alias to get_db_connection() supporting both engines."""
    return get_db_connection()


# ---------------------------------------------------------------------------
# Schema Initialization & Seeding
# ---------------------------------------------------------------------------

def init_db() -> None:
    """Initializes the database schema, runs column migrations, and seeds Super Admin."""
    global _db_initialized
    _db_initialized = True

    if is_postgres_active():
        _init_postgres_db()
    else:
        _init_sqlite_db()

    # Seed Admin User
    seed_admin_user()

    # Auto-Restore from Snapshot to populate existing accounts
    auto_restore_if_needed()


def _init_postgres_db() -> None:
    """Creates tables and runs migrations on Cloud PostgreSQL."""
    with _get_pg_connection() as conn:
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
                last_ip TEXT,
                last_device TEXT,
                registration_method TEXT DEFAULT 'email',
                session_count INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);")

        # Column migrations
        cols = [
            ("phone", "TEXT"),
            ("plain_password", "TEXT"),
            ("role", "TEXT DEFAULT 'user'"),
            ("status", "TEXT DEFAULT 'active'"),
            ("dietary_preferences", "TEXT"),
            ("allergens", "TEXT"),
            ("health_goals", "TEXT"),
            ("scans_count", "INTEGER DEFAULT 0"),
            ("last_login", "TEXT"),
            ("last_ip", "TEXT"),
            ("last_device", "TEXT"),
            ("registration_method", "TEXT DEFAULT 'email'"),
            ("session_count", "INTEGER DEFAULT 1"),
        ]
        for cname, ctype in cols:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {cname} {ctype};")
            except Exception as e:
                logger.debug("PostgreSQL column migration for %s: %s", cname, e)

        # 2. Activity Logs Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                user_email TEXT,
                action TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                device_info TEXT,
                timestamp TEXT NOT NULL
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON activity_logs(timestamp);")
        try:
            cursor.execute("ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS device_info TEXT;")
        except Exception:
            pass

        # 3. Scans History Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scans_history (
                id SERIAL PRIMARY KEY,
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

    logger.info("Initialized Cloud PostgreSQL persistent database successfully.")


def _init_sqlite_db() -> None:
    """Creates tables and runs migrations on SQLite WAL database."""
    with _get_sqlite_connection() as conn:
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
            "last_ip": "TEXT",
            "last_device": "TEXT",
            "registration_method": "TEXT DEFAULT 'email'",
            "session_count": "INTEGER DEFAULT 1",
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
                device_info TEXT,
                timestamp TEXT NOT NULL
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON activity_logs(timestamp);")

        cursor.execute("PRAGMA table_info(activity_logs);")
        existing_log_cols = {row["name"] for row in cursor.fetchall()}
        if "device_info" not in existing_log_cols:
            try:
                cursor.execute("ALTER TABLE activity_logs ADD COLUMN device_info TEXT;")
            except Exception:
                pass

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


def seed_admin_user() -> None:
    """Ensures the Super Admin account (yaadvshubham01@gmail.com) exists with role='admin'."""
    now_iso = datetime.now(timezone.utc).isoformat()
    clean_email = ADMIN_EMAIL.strip().lower()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (clean_email,))
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
            cursor.execute("""
                UPDATE users
                SET role = 'admin',
                    hashed_password = ?,
                    plain_password = ?,
                    status = 'active',
                    updated_at = ?
                WHERE LOWER(email) = ?
            """, (hashed, ADMIN_PASSWORD, now_iso, clean_email))
            conn.commit()


# ---------------------------------------------------------------------------
# Persistent Snapshot Backup & Auto-Recovery Layer
# ---------------------------------------------------------------------------

def auto_restore_if_needed() -> None:
    """Restores user accounts from snapshot file if any snapshot users are missing from active DB."""
    if not os.path.exists(SNAPSHOT_PATH):
        return
    try:
        with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        snapshot_users = data.get("users", [])
        if not snapshot_users:
            return

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT LOWER(email) as email FROM users")
            rows = cursor.fetchall()
            existing_emails = {r["email"].strip().lower() for r in rows if r["email"]}

            missing_users = [
                u for u in snapshot_users
                if u.get("email") and u.get("email").strip().lower() not in existing_emails
            ]

            if missing_users:
                logger.info("Found %d snapshot users missing from active database. Auto-restoring...", len(missing_users))
                res = restore_from_snapshot({
                    "users": missing_users,
                    "scans": data.get("scans", []),
                    "logs": data.get("logs", []),
                })
                logger.info("Auto-restored missing snapshot users: %s", res)
    except Exception as e:
        logger.warning("Auto restore check skipped: %s", e)


def export_snapshot() -> Dict[str, Any]:
    """Serializes all users, credentials, activity logs, and scans into a JSON dictionary."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users ORDER BY created_at DESC")
        users = [dict(r) for r in cursor.fetchall()]
        cursor.execute("SELECT * FROM scans_history ORDER BY id DESC LIMIT 1000")
        scans = [dict(r) for r in cursor.fetchall()]
        cursor.execute("SELECT * FROM activity_logs ORDER BY id DESC LIMIT 2000")
        logs = [dict(r) for r in cursor.fetchall()]

        return {
            "version": 1,
            "storage_engine": "PostgreSQL" if is_postgres_active() else "SQLite",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "users": users,
            "scans": scans,
            "logs": logs,
        }


def auto_save_snapshot() -> None:
    """Flushes full user and activity snapshot to disk to survive container restarts."""
    try:
        data = export_snapshot()
        os.makedirs(DB_DIR, exist_ok=True)
        with open(SNAPSHOT_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.warning("Could not auto-save snapshot: %s", e)


def restore_from_snapshot(data: Dict[str, Any]) -> Dict[str, int]:
    """Restores database from a snapshot dictionary with ANSI standard SQL across both engines."""
    users_restored = 0
    scans_restored = 0
    logs_restored = 0

    with get_db_connection() as conn:
        cursor = conn.cursor()
        for u in data.get("users", []):
            try:
                email = (u.get("email") or "").strip().lower()
                if not email:
                    continue

                diet = u.get("dietary_preferences")
                if isinstance(diet, (list, dict)):
                    diet = json.dumps(diet)
                allergens = u.get("allergens")
                if isinstance(allergens, (list, dict)):
                    allergens = json.dumps(allergens)
                goals = u.get("health_goals")
                if isinstance(goals, (list, dict)):
                    goals = json.dumps(goals)

                cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
                existing = cursor.fetchone()

                if existing:
                    cursor.execute("""
                        UPDATE users SET
                            google_sub = COALESCE(?, google_sub),
                            phone = COALESCE(?, phone),
                            name = COALESCE(?, name),
                            picture = COALESCE(?, picture),
                            hashed_password = COALESCE(?, hashed_password),
                            plain_password = COALESCE(?, plain_password),
                            role = ?,
                            status = ?,
                            dietary_preferences = ?,
                            allergens = ?,
                            health_goals = ?,
                            scans_count = ?,
                            last_login = COALESCE(?, last_login),
                            last_ip = COALESCE(?, last_ip),
                            last_device = COALESCE(?, last_device),
                            session_count = COALESCE(?, session_count),
                            updated_at = ?
                        WHERE LOWER(email) = ?
                    """, (
                        u.get("google_sub"),
                        u.get("phone"),
                        u.get("name"),
                        u.get("picture"),
                        u.get("hashed_password"),
                        u.get("plain_password"),
                        u.get("role", "user"),
                        u.get("status", "active"),
                        diet,
                        allergens,
                        goals,
                        u.get("scans_count", 0),
                        u.get("last_login"),
                        u.get("last_ip"),
                        u.get("last_device"),
                        u.get("session_count", 1),
                        u.get("updated_at") or datetime.now(timezone.utc).isoformat(),
                        email,
                    ))
                else:
                    cursor.execute("""
                        INSERT INTO users (
                            id, google_sub, email, phone, email_verified, name, picture,
                            hashed_password, plain_password, role, status, dietary_preferences,
                            allergens, health_goals, scans_count, last_login, last_ip,
                            last_device, registration_method, session_count, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        u.get("id"),
                        u.get("google_sub"),
                        email,
                        u.get("phone"),
                        u.get("email_verified", 0),
                        u.get("name"),
                        u.get("picture"),
                        u.get("hashed_password"),
                        u.get("plain_password"),
                        u.get("role", "user"),
                        u.get("status", "active"),
                        diet,
                        allergens,
                        goals,
                        u.get("scans_count", 0),
                        u.get("last_login"),
                        u.get("last_ip"),
                        u.get("last_device"),
                        u.get("registration_method", "email"),
                        u.get("session_count", 1),
                        u.get("created_at") or datetime.now(timezone.utc).isoformat(),
                        u.get("updated_at") or datetime.now(timezone.utc).isoformat(),
                    ))
                users_restored += 1
            except Exception as ue:
                logger.warning("Could not restore user %s: %s", u.get("email"), ue)

        for s in data.get("scans", []):
            try:
                cursor.execute("""
                    INSERT INTO scans_history (user_email, product_code, product_name, brand, grade, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    s.get("user_email"),
                    s.get("product_code"),
                    s.get("product_name"),
                    s.get("brand"),
                    s.get("grade"),
                    s.get("timestamp"),
                ))
                scans_restored += 1
            except Exception:
                pass

        for l in data.get("logs", []):
            try:
                cursor.execute("""
                    INSERT INTO activity_logs (user_email, action, details, ip_address, device_info, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    l.get("user_email"),
                    l.get("action"),
                    l.get("details"),
                    l.get("ip_address"),
                    l.get("device_info"),
                    l.get("timestamp"),
                ))
                logs_restored += 1
            except Exception:
                pass

        conn.commit()

    return {"users_restored": users_restored, "scans_restored": scans_restored, "logs_restored": logs_restored}


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
        cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (clean_email,))
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
    last_ip: Optional[str] = None,
    last_device: Optional[str] = None,
    registration_method: Optional[str] = None,
) -> Dict[str, Any]:
    """Saves or updates a user in the database, ensuring yaadvshubham01@gmail.com is always Admin,
    tracking sessions, and saving snapshots persistently."""
    clean_email = email.strip().lower()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Admin Rule enforcement
    if clean_email == ADMIN_EMAIL.lower():
        assigned_role = "admin"
    else:
        assigned_role = role or "user"

    reg_method = registration_method or ("google" if google_sub else ("phone" if phone and "@" not in clean_email else "email"))

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (clean_email,))
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
                    last_ip = COALESCE(?, last_ip),
                    last_device = COALESCE(?, last_device),
                    session_count = COALESCE(session_count, 0) + 1,
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
                last_ip,
                last_device,
                now_iso,
                user_id,
            ))
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            user_data = dict(cursor.fetchone())
            auto_save_snapshot()
            return user_data
        else:
            import uuid
            user_id = f"usr_{uuid.uuid4().hex[:14]}"
            display_name = name or clean_email.split("@")[0].capitalize()
            cursor.execute("""
                INSERT INTO users (
                    id, email, phone, google_sub, name, picture,
                    hashed_password, plain_password, role, status,
                    email_verified, last_login, last_ip, last_device,
                    registration_method, session_count, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?, 1, ?, ?)
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
                last_ip or "127.0.0.1",
                last_device or "Web Browser",
                reg_method,
                now_iso,
                now_iso,
            ))
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            user_data = dict(cursor.fetchone())
            auto_save_snapshot()
            return user_data


def record_user_scan(user_email: str, product_code: str, product_name: str, brand: str = "", grade: str = "") -> None:
    """Logs a scan in scans_history, increments user's scans_count, and syncs snapshot."""
    clean_email = user_email.strip().lower()
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO scans_history (user_email, product_code, product_name, brand, grade, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (clean_email, product_code, product_name, brand, grade, now_iso))
        cursor.execute("UPDATE users SET scans_count = COALESCE(scans_count, 0) + 1 WHERE LOWER(email) = ?", (clean_email,))
        conn.commit()
    auto_save_snapshot()


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
            try:
                u["dietary_preferences"] = json.loads(u["dietary_preferences"]) if u.get("dietary_preferences") else []
            except Exception:
                u["dietary_preferences"] = []
            try:
                u["allergens"] = json.loads(u["allergens"]) if u.get("allergens") else []
            except Exception:
                u["allergens"] = []
            try:
                u["health_goals"] = json.loads(u["health_goals"]) if u.get("health_goals") else []
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

        cursor.execute("""
            SELECT * FROM scans_history WHERE LOWER(user_email) = ? ORDER BY timestamp DESC LIMIT 10
        """, (clean_email,))
        scans = [dict(r) for r in cursor.fetchall()]

        cursor.execute("""
            SELECT * FROM activity_logs WHERE LOWER(user_email) = ? ORDER BY timestamp DESC LIMIT 15
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
        updated = dict(cursor.fetchone())
    auto_save_snapshot()
    return updated


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
        cursor.execute("DELETE FROM scans_history WHERE LOWER(user_email) = ?", (user["email"].lower(),))
        cursor.execute("DELETE FROM activity_logs WHERE LOWER(user_email) = ?", (user["email"].lower(),))
        conn.commit()
    auto_save_snapshot()
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

        cursor.execute("""
            SELECT grade, COUNT(*) as count FROM scans_history WHERE grade IS NOT NULL AND grade != '' GROUP BY grade ORDER BY grade ASC;
        """)
        grade_rows = cursor.fetchall()
        grade_distribution = {r["grade"]: r["count"] for r in grade_rows}

        cursor.execute("SELECT dietary_preferences, allergens FROM users;")
        user_rows = cursor.fetchall()
        dietary_counts: Dict[str, int] = {}
        allergen_counts: Dict[str, int] = {}

        for r in user_rows:
            diet = r["dietary_preferences"]
            if diet:
                try:
                    d_list = json.loads(diet)
                    for d in d_list:
                        dietary_counts[d] = dietary_counts.get(d, 0) + 1
                except Exception:
                    pass
            allergens = r["allergens"]
            if allergens:
                try:
                    a_list = json.loads(allergens)
                    for a in a_list:
                        allergen_counts[a] = allergen_counts.get(a, 0) + 1
                except Exception:
                    pass

        cursor.execute("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 20;")
        recent_logs = [dict(r) for r in cursor.fetchall()]

        if is_postgres_active():
            engine_label = "PostgreSQL (Cloud Persistent - 0 Data Loss)"
            engine_type = "cloud_postgres"
            try:
                cursor.execute("SELECT pg_database_size(current_database()) as size;")
                db_size_bytes = cursor.fetchone()["size"]
            except Exception:
                db_size_bytes = 1048576
        else:
            engine_label = "SQLite WAL Mode (Local Disk)"
            engine_type = "sqlite_wal"
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
            "storage_engine": engine_label,
            "engine_type": engine_type,
            "is_postgres": is_postgres_active(),
            "db_path": "Cloud PostgreSQL Database" if is_postgres_active() else DB_PATH,
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
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
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
        created = dict(cursor.fetchone())
    auto_save_snapshot()
    return created
