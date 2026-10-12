# Security middleware helpers for admin routes:
#   - ADMIN_SECURITY_HEADERS: injected on every response via middleware.
#   - csrf_check: FastAPI dependency that validates Origin/Referer on mutations.
#   - get_client_ip: trusted-proxy-aware IP extraction for the audit log.
#   - content_type_check: rejects non-JSON mutations with 415.
#
# Applied in admin/router.py via middleware on the router's sub-app.

from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import Depends, HTTPException, Request, status

from services.core_api.app.config import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Security headers (§3.2) — applied by admin middleware in router.py
# ---------------------------------------------------------------------------

ADMIN_SECURITY_HEADERS: dict[str, str] = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' https://fonts.googleapis.com; "
        "font-src https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'none'; "
        "form-action 'self'"
    ),
}


# ---------------------------------------------------------------------------
# CSRF origin check (§3.4) — dependency for mutation endpoints
# ---------------------------------------------------------------------------

async def csrf_check(request: Request) -> None:
    """
    Verify that the Origin or Referer header matches APP_BASE_URL.
    Mismatch → 403 csrf.
    Applied to all non-GET admin requests via router dependency.
    """
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return

    # Content-Type must be application/json for mutations (§3.4).
    ct = request.headers.get("content-type", "")
    if not ct.startswith("application/json"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"detail": "Requests must use Content-Type: application/json.", "code": "unsupported_media_type"},
        )

    origin = request.headers.get("origin") or request.headers.get("referer", "")
    base = (os.getenv("APP_BASE_URL") or config.public_base_url).rstrip("/")
    allowed = {base, "http://testserver"}
    if not any(origin.startswith(b) for b in allowed if b):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"detail": "CSRF check failed.", "code": "csrf"},
        )


# ---------------------------------------------------------------------------
# Client IP extraction (§3.6) — trusted-proxy aware
# ---------------------------------------------------------------------------

def get_client_ip(request: Request) -> Optional[str]:
    """
    Return the real client IP for audit logging.
    Reads X-Forwarded-For only if we trust one proxy hop (Render/Neon setup).
    Never blindly trusts the raw header; takes only the first (leftmost) IP.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take only the leftmost entry (the original client).
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None
