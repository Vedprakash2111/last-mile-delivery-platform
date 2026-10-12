# admin/router.py
#
# Thin aggregator: combines all admin sub-routers into a single APIRouter
# mounted at /api/admin with shared require_admin + csrf_check dependencies.
#
# Route logic lives in admin/routes/*.py.
# Shared helpers (error builders, DB utilities) live in admin/common.py.
# Business rules live in admin/rules.py.
# Auth dependency lives in admin/deps.py.
# CSRF + IP helpers live in admin/security.py.

from __future__ import annotations

from fastapi import APIRouter, Depends

from services.core_api.app.admin.deps import require_admin
from services.core_api.app.admin.security import csrf_check
from services.core_api.app.admin.routes.overview import router as overview_router
from services.core_api.app.admin.routes.drivers import router as drivers_router
from services.core_api.app.admin.routes.users import router as users_router
from services.core_api.app.admin.routes.merchants import router as merchants_router
from services.core_api.app.admin.routes.warehouses import router as warehouses_router
from services.core_api.app.admin.routes.orders import router as orders_router
from services.core_api.app.admin.routes.activity import router as activity_router

# ---------------------------------------------------------------------------
# Master admin router
# ---------------------------------------------------------------------------
# csrf_check runs first; require_admin runs second.
# Both are applied at the router level so every sub-route inherits them
# without each handler needing to declare them.

router = APIRouter(
    prefix="/api/admin",
    dependencies=[Depends(csrf_check), Depends(require_admin)],
)

router.include_router(overview_router)
router.include_router(drivers_router)
router.include_router(users_router)
router.include_router(merchants_router)
router.include_router(warehouses_router)
router.include_router(orders_router)
router.include_router(activity_router)
