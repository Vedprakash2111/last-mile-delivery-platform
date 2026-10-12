# Pure state-machine and validation helpers for the admin domain (§8).
# These functions take plain values (no DB session) and return a result or
# raise a ValueError with a machine-readable code.
# They are the authoritative business rules and are unit-tested without a DB.

from __future__ import annotations

import base64
import json
import re
import uuid
from datetime import datetime
from typing import Literal, Optional, Tuple

# ---------------------------------------------------------------------------
# Allowed sort columns (whitelists) — never interpolate user input
# ---------------------------------------------------------------------------

DRIVER_SORT_COLS = frozenset({"created_at", "full_name", "last_login_at", "status"})
USER_SORT_COLS   = frozenset({"created_at", "full_name", "last_login_at"})
MERCHANT_SORT_COLS = frozenset({"name", "created_at", "orders_total"})
WAREHOUSE_SORT_COLS = frozenset({"code", "name", "open_orders", "created_at"})
SORT_DIRS = frozenset({"asc", "desc"})

# Roles the admin console may grant / revoke (§2)
ASSIGNABLE_ROLES = frozenset({"dispatcher", "fleet_manager", "admin"})

# Open-order statuses (§4.1)
OPEN_ORDER_STATUSES = ("pending", "assigned", "out_for_delivery", "attempt_failed")

# Active-route statuses
ACTIVE_ROUTE_STATUSES = ("planned", "in_progress")

# ---------------------------------------------------------------------------
# Warehouse code validation
# ---------------------------------------------------------------------------

_WH_CODE_RE = re.compile(r"^[A-Z0-9\-]{2,12}$")


def validate_warehouse_code(raw: str) -> str:
    """Trim, uppercase, and validate warehouse code. Returns cleaned code or raises ValueError."""
    code = raw.strip().upper()
    if not _WH_CODE_RE.match(code):
        raise ValueError("warehouse_code_invalid")
    return code


# ---------------------------------------------------------------------------
# Coordinate validation
# ---------------------------------------------------------------------------

def validate_coordinates(latitude: float, longitude: float) -> None:
    """Raise ValueError if lat/lon are out of range."""
    if not (-90.0 <= latitude <= 90.0):
        raise ValueError("latitude_out_of_range")
    if not (-180.0 <= longitude <= 180.0):
        raise ValueError("longitude_out_of_range")


# ---------------------------------------------------------------------------
# q (search) escaping for ILIKE
# ---------------------------------------------------------------------------

def escape_ilike(q: str) -> str:
    """Escape % and _ in a search string before wrapping in %…% for ILIKE."""
    return q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def prepare_q(raw: Optional[str]) -> Optional[str]:
    """Trim, reject < 2 chars, escape for ILIKE, wrap in %…%."""
    if not raw:
        return None
    trimmed = raw.strip()[:100]
    if len(trimmed) < 2:
        return None
    return f"%{escape_ilike(trimmed)}%"


# ---------------------------------------------------------------------------
# Cursor encode / decode (§5.1)
# Cursor is opaque base64 of JSON {"ts": ISO, "id": int|str}
# ---------------------------------------------------------------------------

def encode_cursor(ts: datetime, row_id: int | str) -> str:
    payload = json.dumps({"ts": ts.isoformat(), "id": str(row_id)})
    return base64.urlsafe_b64encode(payload.encode()).decode()


def decode_cursor(cursor: str) -> Tuple[datetime, str]:
    """Return (datetime, row_id_str). Raises ValueError on malformed cursor."""
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        data = json.loads(raw)
        ts = datetime.fromisoformat(data["ts"])
        row_id = data["id"]
        return ts, row_id
    except Exception as exc:
        raise ValueError("invalid_cursor") from exc


# ---------------------------------------------------------------------------
# Sort whitelist check
# ---------------------------------------------------------------------------

def validate_sort(sort: str, allowed: frozenset) -> None:
    if sort not in allowed:
        raise ValueError(f"invalid_sort_column: {sort!r}. Allowed: {sorted(allowed)}")


def validate_dir(dir_: str) -> None:
    if dir_ not in SORT_DIRS:
        raise ValueError(f"invalid_sort_direction: {dir_!r}. Use asc or desc.")


# ---------------------------------------------------------------------------
# Driver state transition (§8)
# Returns (new_status_str, is_valid)
# ---------------------------------------------------------------------------

def driver_verify_transition(current_status: str) -> str:
    """pending|rejected → offline. Other states raise ValueError(current_status)."""
    if current_status in ("pending", "rejected"):
        return "offline"
    raise ValueError(current_status)


def driver_reject_transition(current_status: str) -> str:
    """pending → rejected. Other states raise ValueError(current_status)."""
    if current_status == "pending":
        return "rejected"
    raise ValueError(current_status)


# ---------------------------------------------------------------------------
# Tracking-token format check (for orders q)
# ---------------------------------------------------------------------------

_TRACKING_RE = re.compile(r"^[A-Z]{10}$")
_PHONE_RE = re.compile(r"^\+[1-9][0-9]{7,14}$")


def classify_q(q: str) -> Literal["tracking_token", "phone", "text"]:
    """Classify a raw search string to determine which field to query."""
    normalized = q.strip().upper()
    if _TRACKING_RE.match(normalized):
        return "tracking_token"
    if _PHONE_RE.match(q.strip()):
        return "phone"
    return "text"
