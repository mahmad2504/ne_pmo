import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import init_db
from app.errors import AppError
from app.routers import (
    catalog,
    companies,
    departments,
    designations,
    project_groups,
    project_sections,
    projects,
    resources,
    tags,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if os.environ.get("TESTING") != "1":
        init_db()
    yield


app = FastAPI(title="NE PM Tool", lifespan=lifespan)

_origins = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5174,http://127.0.0.1:5174,http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_request: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_handler(_request: Request, exc: RequestValidationError):
    messages: list[str] = []
    for err in exc.errors():
        msg = str(err.get("msg", "Invalid value"))
        prefix = "Value error, "
        if msg.startswith(prefix):
            msg = msg[len(prefix) :]
        if msg and msg not in messages:
            messages.append(msg)
    return JSONResponse(
        status_code=422,
        content={"detail": " ".join(messages) or "Invalid request"},
    )


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(resources.router)
app.include_router(projects.router)
app.include_router(project_groups.router)
app.include_router(project_sections.router)
app.include_router(designations.router)
app.include_router(departments.router)
app.include_router(companies.router)
app.include_router(catalog.router)
app.include_router(tags.router)
