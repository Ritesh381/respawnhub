from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .metrics import register_collectors
from .routers import bookings, floor, stations

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Station booking and live floor status for a gaming cafe.",
)
app.include_router(stations.router)
app.include_router(bookings.router)
app.include_router(floor.router)

Instrumentator(excluded_handlers=["/metrics", "/health", "/ready"]).instrument(app).expose(
    app, endpoint="/metrics", include_in_schema=False
)
register_collectors()


@app.get("/", tags=["service"])
def root():
    return {"service": settings.app_name, "version": settings.app_version, "docs": "/docs"}


@app.get("/api/meta", tags=["service"])
def meta():
    """Which build is running. The UI shows this so a deploy is easy to spot."""
    return {"version": settings.app_version, "cafe_timezone": settings.cafe_tz}


@app.get("/health", tags=["service"])
def health():
    """Liveness: the process is up. Does not touch the database."""
    return {"status": "UP"}


@app.get("/ready", tags=["service"])
def ready(db: Session = Depends(get_db)):
    """Readiness: only send traffic here if the database answers."""
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "NOT_READY"})
    return {"status": "READY"}
