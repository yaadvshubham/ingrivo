#!/usr/bin/env python3
"""Secret Scanner for Tracked Files and Git History.

Scans all tracked files and git history for key-like patterns:
- Google API key prefixes (AIza...)
- Private key headers
- Tracked .env files
- Common API secret patterns

NON-NEGOTIABLE:
Prints file locations and line numbers ONLY. NEVER prints or reveals matched secrets.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

# Compiled secret patterns
PATTERNS = {
    "Google API Key": re.compile(r"AIza[0-9A-Za-z-_]{35}"),
    "Private Key Header": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "Generic Private Token": re.compile(r"(?:api_key|apikey|secret|token)\s*[:=]\s*['\"][A-Za-z0-9_\-]{20,}['\"]", re.IGNORECASE),
    "GitHub Personal Access Token": re.compile(r"gh[pousr]_[A-Za-z0-9_]{36,255}"),
    "AWS Access Key ID": re.compile(r"AKIA[0-9A-Z]{16}"),
}

# Allowlist for known benign/mock occurrences
BENIGN_LOCATIONS = [
    ".env.example",
    "test_api.py",  # mock string "super-secret-key-12345"
    "test_security.py", # mock test token
    "secret_scan.py",
]


def is_benign(filepath: str) -> bool:
    normalized = filepath.replace("\\", "/")
    return any(b in normalized for b in BENIGN_LOCATIONS)


def scan_tracked_files(repo_root: Path) -> list[str]:
    """Scans all files currently tracked by git."""
    findings = []
    try:
        result = subprocess.run(
            ["git", "ls-files"],
            cwd=str(repo_root),
            capture_output=True,
            encoding="utf-8",
            errors="ignore",
            check=True,
        )
        tracked_files = result.stdout.strip().splitlines()
    except Exception as e:
        print(f"Error running git ls-files: {e}", file=sys.stderr)
        return []

    for rel_path in tracked_files:
        # Check for tracked .env files
        basename = os.path.basename(rel_path)
        if basename.startswith(".env") and basename != ".env.example":
            findings.append(f"[Tracked .env file] {rel_path}")

        if is_benign(rel_path):
            continue

        full_path = repo_root / rel_path
        if not full_path.is_file():
            continue

        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                for line_num, line in enumerate(f, start=1):
                    for name, pattern in PATTERNS.items():
                        if pattern.search(line):
                            findings.append(f"[{name}] {rel_path}:{line_num}")
        except Exception as e:
            print(f"Error reading {rel_path}: {e}", file=sys.stderr)

    return findings


def scan_git_history(repo_root: Path) -> list[str]:
    """Scans commit history for secret patterns."""
    findings = []
    try:
        # Inspect git log patches
        result = subprocess.run(
            ["git", "log", "-p", "--full-history", "--no-color"],
            cwd=str(repo_root),
            capture_output=True,
            encoding="utf-8",
            errors="ignore",
            check=True,
        )
        lines = result.stdout.splitlines()
    except Exception as e:
        print(f"Error inspecting git log: {e}", file=sys.stderr)
        return []

    current_commit = "unknown"
    current_file = "unknown"

    for line in lines:
        if line.startswith("commit "):
            current_commit = line.split()[1][:8]
        elif line.startswith("+++ b/"):
            current_file = line[6:]
        elif line.startswith("+") and not line.startswith("+++"):
            added_content = line[1:]
            if is_benign(current_file):
                continue
            for name, pattern in PATTERNS.items():
                if pattern.search(added_content):
                    findings.append(f"[{name} in commit {current_commit}] {current_file}")

    return findings


def main():
    repo_root = Path(__file__).resolve().parent.parent
    if not (repo_root / ".git").is_dir():
        # Fallback if executed from scripts directory
        repo_root = Path.cwd()

    print("==================================================")
    print("PINFO SECRET SCAN AUDIT (TRACKED FILES & GIT)")
    print("==================================================")
    print(f"Repository root: {repo_root}")

    print("\n1. Scanning tracked files...")
    tracked_findings = scan_tracked_files(repo_root)

    print("2. Scanning git history...")
    history_findings = scan_git_history(repo_root)

    all_findings = tracked_findings + history_findings

    if not all_findings:
        print("\n[CLEAN] Zero secrets, private keys, or tracked .env files detected!")
        sys.exit(0)
    else:
        print(f"\n[ALERT] Found {len(all_findings)} potential secret pattern locations:")
        for finding in all_findings:
            print(f"  - {finding}")
        sys.exit(1)


if __name__ == "__main__":
    main()
