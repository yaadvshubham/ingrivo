"""Tests for Super Admin Panel, Role Enforcement, and Credentials Visibility."""

import pytest
from starlette.testclient import TestClient
from app.main import app
from app.db.database import ADMIN_EMAIL, ADMIN_PASSWORD


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_admin_password_login_success(client):
    """yaadvshubham01@gmail.com with @jaishankar2931 logs in as role='admin'."""
    res = client.post(
        "/api/v1/auth/login-password",
        json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["user"]["email"] == ADMIN_EMAIL.lower()
    assert data["user"]["role"] == "admin"
    assert "access_token" in data


def test_admin_google_login_role_admin(client):
    """Google sign-in with yaadvshubham01@gmail.com is treated as admin."""
    res = client.post(
        "/api/v1/auth/google",
        json={
            "email": ADMIN_EMAIL,
            "name": "Shubham Yadav",
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["user"]["email"] == ADMIN_EMAIL.lower()
    assert data["user"]["role"] == "admin"


def test_regular_user_cannot_access_admin_stats(client):
    """Unauthenticated visitor is rejected from /api/v1/admin/stats."""
    res = client.get("/api/v1/admin/stats")
    assert res.status_code == 401


def test_regular_user_forbidden_from_admin_endpoints(client):
    """Regular user receives 403 Forbidden when trying to access admin endpoints."""
    # Register normal user
    client.post(
        "/api/v1/auth/register",
        json={
            "identifier": "regular.user@example.com",
            "password": "Password#123",
            "name": "Regular User",
        },
    )

    login_res = client.post(
        "/api/v1/auth/login-password",
        json={"identifier": "regular.user@example.com", "password": "Password#123"},
    )
    user_token = login_res.json()["access_token"]

    # Try admin stats
    res = client.get(
        "/api/v1/admin/stats",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 403
    err_data = res.json()
    msg = err_data.get("error", {}).get("message", "") or err_data.get("detail", "")
    assert "Admin privileges required" in msg


def test_admin_can_access_stats_and_inspect_users_with_passwords(client):
    """Admin can list users and view credentials."""
    login_res = client.post(
        "/api/v1/auth/login-password",
        json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    admin_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Stats
    stats_res = client.get("/api/v1/admin/stats", headers=headers)
    assert stats_res.status_code == 200
    stats_data = stats_res.json()["data"]
    assert stats_data["total_users"] >= 1
    assert stats_data["super_admin"] == ADMIN_EMAIL

    # 2. Users list with plain_password visibility
    users_res = client.get("/api/v1/admin/users", headers=headers)
    assert users_res.status_code == 200
    users_list = users_res.json()["users"]
    assert len(users_list) > 0

    # Ensure admin user has plain_password accessible
    admin_user = next((u for u in users_list if u["email"].lower() == ADMIN_EMAIL.lower()), None)
    assert admin_user is not None
    assert admin_user["plain_password"] == ADMIN_PASSWORD


def test_admin_can_create_update_and_delete_user(client):
    """Admin can perform full CRUD on user accounts."""
    login_res = client.post(
        "/api/v1/auth/login-password",
        json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    admin_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    import uuid
    test_email = f"test.user.{uuid.uuid4().hex[:6]}@example.com"

    # Create
    create_res = client.post(
        "/api/v1/admin/users",
        headers=headers,
        json={
            "email": test_email,
            "name": "Test Managed User",
            "password": "CustomSecret#2026",
            "role": "user",
            "status": "active",
        },
    )
    assert create_res.status_code == 201
    created_id = create_res.json()["user"]["id"]

    # Update
    update_res = client.put(
        f"/api/v1/admin/users/{created_id}",
        headers=headers,
        json={"name": "Updated Name", "status": "suspended"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["user"]["name"] == "Updated Name"
    assert update_res.json()["user"]["status"] == "suspended"

    # Delete
    del_res = client.delete(f"/api/v1/admin/users/{created_id}", headers=headers)
    assert del_res.status_code == 200


def test_cannot_delete_primary_super_admin(client):
    """Primary admin yaadvshubham01@gmail.com is protected from deletion."""
    login_res = client.post(
        "/api/v1/auth/login-password",
        json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    admin_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    users_res = client.get("/api/v1/admin/users", headers=headers)
    admin_user = next(u for u in users_res.json()["users"] if u["email"].lower() == ADMIN_EMAIL.lower())

    del_res = client.delete(f"/api/v1/admin/users/{admin_user['id']}", headers=headers)
    assert del_res.status_code == 400
