#!/usr/bin/env python3
"""
Bundle check script for Phase 10 (Item 12).
Scans production frontend build output (.next/) for key-like strings
and references to backend-only environment variables.
Reports counts only.
"""

import os
import re
from pathlib import Path

BACKEND_ONLY_ENV_VARS = [
    "GEMINI_API_KEY",
    "OFF_STAGING_BASIC_AUTH",
    "OFF_USER_AGENT",
    "SAL_BASE_URL",
    "DOCS_ENABLED",
    "MAX_REQUEST_BODY_BYTES",
]

SECRET_PATTERNS = [
    re.compile(r"AIza[0-9A-Za-z-_]{35}"),
    re.compile(r"-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----"),
    re.compile(r"ghp_[0-9a-zA-Z]{36}"),
]

def scan_bundle(bundle_dir: Path):
    if not bundle_dir.exists():
        print(f"[ERROR] Bundle directory {bundle_dir} does not exist. Run npm run build first.")
        return

    secret_matches_count = 0
    backend_env_matches = {var: 0 for var in BACKEND_ONLY_ENV_VARS}
    files_scanned = 0

    for root, dirs, files in os.walk(bundle_dir):
        # Exclude internal Turbopack compiler cache
        dirs[:] = [d for d in dirs if d != "cache"]
        for file in files:
            file_path = Path(root) / file
            # Only scan js, html, json, css, txt assets
            if file_path.suffix.lower() not in [".js", ".html", ".json", ".css", ".txt", ".map"]:
                continue

            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                files_scanned += 1

                for pattern in SECRET_PATTERNS:
                    matches = pattern.findall(content)
                    secret_matches_count += len(matches)

                for var in BACKEND_ONLY_ENV_VARS:
                    if var in content:
                        backend_env_matches[var] += content.count(var)

            except Exception:
                pass

    print("========================================")
    print("      FRONTEND BUNDLE SECURITY SCAN     ")
    print("========================================")
    print(f"Directory: {bundle_dir}")
    print(f"Files Scanned: {files_scanned}")
    print(f"Secret-like String Matches: {secret_matches_count}")
    print("Backend-only Environment Variable Matches:")
    for var, count in backend_env_matches.items():
        print(f"  - {var}: {count}")
    print("========================================")

if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent
    bundle_path = repo_root / "frontend" / ".next"
    scan_bundle(bundle_path)
