# Admin workspace shell and static asset server (§3.2).
#
# Shell page: GET /workspaces/admin/operations
# Static assets: GET /workspaces/admin/assets/*
# Redirect: GET /admin -> 302 /workspaces/admin/operations
#
# Gate rules:
#   - Not signed in -> 302 /login?next=/workspaces/admin/operations
#   - Signed in without admin role -> 403 with plain "Access denied" (no admin markup, no JS)
#   - All responses include ADMIN_SECURITY_HEADERS (§3.2)

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db_models.models import User, UserRole
from services.core_api.app.admin.security import ADMIN_SECURITY_HEADERS
from services.core_api.app.auth.security import decode_access_token
from services.core_api.app.database.connection import get_db_session

logger = logging.getLogger(__name__)

router = APIRouter()

# Directory for admin frontend assets (Phase 2 will populate this)
ADMIN_ASSETS_DIR = Path(__file__).resolve().parents[4] / "frontend" / "admin" / "assets"


async def _check_admin_session(
    request: Request,
    access_token: Optional[str],
    db: AsyncSession,
) -> tuple[str, Optional[User]]:
    """
    Check session from cookie or Authorization header.
    Returns:
      ("unauthenticated", None) -> redirect to login
      ("forbidden", user)        -> 403 access denied
      ("ok", user)               -> authenticated admin
    """
    token: Optional[str] = access_token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.removeprefix("Bearer ")

    if not token:
        return "unauthenticated", None

    try:
        payload = decode_access_token(token)
    except JWTError:
        return "unauthenticated", None

    user_id_str = payload.get("sub")
    if not user_id_str:
        return "unauthenticated", None

    import uuid as _uuid
    try:
        user_uuid = _uuid.UUID(user_id_str)
    except ValueError:
        return "unauthenticated", None

    stmt = select(User).options(selectinload(User.roles)).where(User.id == user_uuid)
    user = await db.scalar(stmt)
    if user is None or not user.is_active:
        return "unauthenticated", None

    now = datetime.now(timezone.utc)
    if user.locked_until and user.locked_until > now:
        return "unauthenticated", None

    role_values = {r.role for r in user.roles}
    if UserRole.admin not in role_values:
        return "forbidden", user

    return "ok", user


@router.get("/admin", include_in_schema=False)
async def admin_entrypoint():
    """Redirect /admin to the operations shell page (§3.2)."""
    return RedirectResponse(url="/workspaces/admin/operations", status_code=302)


@router.get("/workspaces/admin/operations", response_class=HTMLResponse)
async def admin_operations_shell(
    request: Request,
    access_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Admin operations shell page.
    Gate: unauthenticated -> 302 login; non-admin -> 403; admin -> placeholder shell HTML.
    """
    state, user = await _check_admin_session(request, access_token, db)
    if state == "unauthenticated":
        return RedirectResponse(
            url="/login?next=/workspaces/admin/operations",
            status_code=302,
        )
    if state == "forbidden":
        return HTMLResponse(
            content="<!DOCTYPE html><html><head><title>Access denied</title></head><body><h1>Access denied</h1><p>You do not have permission to access the admin console.</p></body></html>",
            status_code=403,
            headers=ADMIN_SECURITY_HEADERS,
        )

    # Placeholder shell page for Phase 1 backend
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>LOGIPULSE — Admin Console</title>
</head>
<body>
  <div id="admin-shell-placeholder">
    <h1>LOGIPULSE Admin Console</h1>
    <p>Admin console backend is live. Frontend will be mounted in Phase 2.</p>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html, status_code=200, headers=ADMIN_SECURITY_HEADERS)


@router.get("/workspaces/admin/assets/{asset_path:path}")
async def admin_static_asset(
    asset_path: str,
    request: Request,
    access_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Serve admin assets behind the same authentication gate (§3.2).
    Not mounted as public StaticFiles.
    """
    state, user = await _check_admin_session(request, access_token, db)
    if state == "unauthenticated":
        return RedirectResponse(
            url="/login?next=/workspaces/admin/operations",
            status_code=302,
        )
    if state == "forbidden":
        return HTMLResponse(
            content="<!DOCTYPE html><html><head><title>Access denied</title></head><body><h1>Access denied</h1></body></html>",
            status_code=403,
            headers=ADMIN_SECURITY_HEADERS,
        )

    asset_file = (ADMIN_ASSETS_DIR / asset_path).resolve()
    # Path traversal protection
    try:
        asset_file.relative_to(ADMIN_ASSETS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=404, detail="Asset not found.")

    if not asset_file.is_file():
        raise HTTPException(status_code=404, detail="Asset not found.")

    return FileResponse(asset_file, headers=ADMIN_SECURITY_HEADERS)
