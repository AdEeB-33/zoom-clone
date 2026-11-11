"""Application entry point: wires the routers, CORS and startup tasks together.

Run locally with:  uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.errors import AppError
from app.routers import meetings, users, ws
from app.seed import seed_database
from app.services import meetings as meeting_service


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_database(db)
        meeting_service.end_stale_live_meetings(db)
    yield


app = FastAPI(title="Parley API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api")
app.include_router(meetings.router, prefix="/api")
app.include_router(ws.router)


@app.exception_handler(AppError)
async def handle_app_error(_request: Request, error: AppError) -> JSONResponse:
    """Turn a domain error into the same {"detail": ...} shape FastAPI uses."""
    return JSONResponse(status_code=error.status_code, content={"detail": str(error)})


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
