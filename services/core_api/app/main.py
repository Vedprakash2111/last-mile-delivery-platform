# FORMERLY ORDERS API — The single entry point for Merchants/Staff
# FastAPI application entrypoint for Core API service.

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from services.core_api.app.auth.router import router as auth_router
from services.core_api.app.orders.router import router as orders_router
from services.core_api.app.staff.router import router as staff_router
from services.core_api.app.home.router import router as home_router
from services.core_api.app.tracking.router import router as tracking_router
from services.core_api.app.tracking.router import limiter as tracking_limiter
from services.core_api.app.admin.router import router as admin_router
from services.core_api.app.admin.shell import router as shell_router
from services.core_api.app.admin.security import ADMIN_SECURITY_HEADERS

from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError

app = FastAPI(title="Core API Service", version="1.0.0")

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

# Mount frontend directory for static assets (CSS, JS, Images)
frontend_dir = Path(__file__).resolve().parents[3] / "frontend"
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

app.include_router(home_router, tags=["Home"])
app.include_router(tracking_router, tags=["Tracking"])
app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(orders_router, prefix="/orders", tags=["Orders"])
app.include_router(staff_router, prefix="/staff", tags=["Staff"])
app.include_router(shell_router, tags=["Admin Shell"])
app.include_router(admin_router, tags=["Admin"])

@app.get("/health/live")
async def health_live():
    """Liveness probe confirming the process is running without checking dependencies."""
    return {"status": "live"}

@app.get("/health/ready")
async def health_ready():
    """Readiness probe checking Postgres and Redis connectivity."""
    # TODO: Verify Postgres and Redis connection health
    return {"status": "ready"}
