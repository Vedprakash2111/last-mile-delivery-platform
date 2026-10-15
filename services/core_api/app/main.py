# FORMERLY ORDERS API — The single entry point for Merchants/Staff
# FastAPI application entrypoint for Core API service.

<<<<<<< Updated upstream
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
=======
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.routing import APIRoute
from pathlib import Path
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
import logging
>>>>>>> Stashed changes

from app.auth.router import router as auth_router
from app.orders.router import router as orders_router
from app.staff.router import router as staff_router
from app.home.router import router as home_router

app = FastAPI(title="Core API Service", version="1.0.0")

<<<<<<< Updated upstream
=======
# Attach slowapi limiter state so the rate-limit decorator can resolve it.
app.state.limiter = tracking_limiter


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Format HTTP exceptions according to §5.4 JSON contract."""
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc.detail), "code": "error"},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Format 422 validation errors according to §5.4 JSON contract."""
    errors = []
    for err in exc.errors():
        field_loc = err.get("loc", [])
        field_name = str(field_loc[-1]) if field_loc else "body"
        errors.append({"field": field_name, "message": err.get("msg", "Invalid value")})
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Request validation failed.",
            "code": "validation_error",
            "errors": errors,
        },
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please wait a moment.", "code": "rate_limited"},
    )


@app.middleware("http")
async def admin_security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api/admin") or path.startswith("/workspaces/admin") or path == "/admin":
        for k, v in ADMIN_SECURITY_HEADERS.items():
            response.headers[k] = v
    return response

# Block admin files under the public frontend mount before StaticFiles — these
# files are available only through the authenticated /workspaces/admin/assets route.
@app.get("/static/admin/{rest_of_path:path}", include_in_schema=False)
@app.get("/static/dashboards/admin/{rest_of_path:path}", include_in_schema=False)
async def block_static_admin(rest_of_path: str) -> Response:
    """Admin assets must never be served via /static. Return 404 unconditionally."""
    return Response(status_code=404)

>>>>>>> Stashed changes
# Mount frontend directory for static assets (CSS, JS, Images)
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../frontend"))
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

app.include_router(home_router, tags=["Home"])
app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(orders_router, prefix="/orders", tags=["Orders"])
app.include_router(staff_router, prefix="/staff", tags=["Staff"])

@app.get("/health/live")
async def health_live():
    """Liveness probe confirming the process is running without checking dependencies."""
    return {"status": "live"}


@app.get("/health/ready")
async def health_ready():
    """Readiness probe: checks Postgres (SELECT 1) and Redis (PING)."""
    from services.core_api.app.database.connection import async_session_factory
    from streaming.client import get_redis_client
    errors = []

    # Postgres check
    try:
        async with async_session_factory() as session:
            from sqlalchemy import text as _text
            await session.execute(_text("SELECT 1"))
    except Exception as exc:
        errors.append(f"postgres: {exc}")

    # Redis check
    try:
        redis = await get_redis_client()
        await redis.ping()
    except Exception as exc:
        errors.append(f"redis: {exc}")

    if errors:
        return JSONResponse(status_code=503, content={"status": "not_ready", "errors": errors})
    return {"status": "ready"}
