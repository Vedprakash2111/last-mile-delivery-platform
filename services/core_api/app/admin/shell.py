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
#
from __future__ import annotations

from pathlib import Path
from typing import Optional, Union

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from db_models.models import User
from services.core_api.app.admin.deps import require_admin
from services.core_api.app.admin.security import ADMIN_SECURITY_HEADERS
from services.core_api.app.database.connection import get_db_session

router = APIRouter()

# Admin assets live OUTSIDE frontend/ so they are never reachable via /static.
# The directory is served only through the authenticated /workspaces/admin/assets/* handler.
ADMIN_ASSETS_DIR = Path(__file__).resolve().parents[2] / "admin_assets"


async def _authorize_admin_page(
    request: Request,
    access_token: Optional[str],
    db: AsyncSession,
) -> Union[User, Response]:
    """Apply the shared admin auth check with browser-page responses.

    The API dependency intentionally returns JSON 401/403 errors. HTML page
    requests instead need the login redirect and plain access-denied document
    specified for the admin shell. The identity and role check still come from
    the same ``require_admin`` dependency implementation.
    """
    try:
        return await require_admin(request=request, access_token=access_token, db=db)
    except HTTPException as exc:
        if exc.status_code == 401:
            return RedirectResponse(
                url="/login?next=/workspaces/admin/operations",
                status_code=302,
                headers=ADMIN_SECURITY_HEADERS,
            )
        if exc.status_code == 403:
            return HTMLResponse(
                content=(
                    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
                    "<title>Access denied</title></head><body><h1>Access denied</h1></body></html>"
                ),
                status_code=403,
                headers=ADMIN_SECURITY_HEADERS,
            )
        raise


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
    Browser auth failures are translated to the specified redirect/plain page.
    """
    authorization = await _authorize_admin_page(request, access_token, db)
    if isinstance(authorization, Response):
        return authorization

    shell_file = ADMIN_ASSETS_DIR / "index.html"
    if not shell_file.is_file():
        raise HTTPException(status_code=404, detail="Admin shell is not installed.")
    return FileResponse(shell_file, media_type="text/html", headers=ADMIN_SECURITY_HEADERS)


@router.get("/workspaces/admin/assets/{asset_path:path}")
async def admin_static_asset(
    request: Request,
    asset_path: str,
    access_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Serve admin assets behind the same authentication gate (§3.2).
    Not mounted as public StaticFiles.
    Uses the same database-backed admin check as the shell.
    """
    authorization = await _authorize_admin_page(request, access_token, db)
    if isinstance(authorization, Response):
        return authorization

    asset_file = (ADMIN_ASSETS_DIR / asset_path).resolve()
    # Path traversal protection
    try:
        asset_file.relative_to(ADMIN_ASSETS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=404, detail="Asset not found.")

    if not asset_file.is_file():
        raise HTTPException(status_code=404, detail="Asset not found.")

    return FileResponse(asset_file, headers=ADMIN_SECURITY_HEADERS)
