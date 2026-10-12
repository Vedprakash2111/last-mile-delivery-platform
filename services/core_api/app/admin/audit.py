# Admin audit helper.
# write_audit() inserts one row into admin_audit_log within the CALLER'S
# open transaction. The caller commits; we never commit here.
#
# action values (exhaustive list from §4.2):
#   driver.verify, driver.reject,
#   user.invite, user.deactivate, user.reactivate, user.unlock,
#   user.revoke_sessions, user.send_reset, user.resend_invite,
#   user.role_grant, user.role_revoke,
#   merchant.create, merchant.update, merchant.deactivate, merchant.reactivate,
#   warehouse.create, warehouse.update, warehouse.deactivate, warehouse.reactivate,
#   warehouse.staff_add, warehouse.staff_remove
#
# details may hold: reason, before/after dicts of changed fields, role name,
# warehouse_ids.  NEVER put passwords, hashes, or tokens in details.

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text as sql_text

from db_models.models import AdminAuditLog, User


async def write_audit(
    db: AsyncSession,
    *,
    actor: User,
    action: str,
    target_type: str,          # 'user' | 'driver' | 'merchant' | 'warehouse'
    target_id: uuid.UUID,
    target_label: str,         # snapshot name/code so the log stays readable
    details: Optional[Dict[str, Any]] = None,
    ip: Optional[str] = None,
) -> None:
    """Insert one audit row into the caller's open transaction.
    Caller must commit after this returns."""
    db.add(AdminAuditLog(
        actor_user_id=actor.id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_label=target_label,
        details=details or {},
        ip=ip,
    ))
