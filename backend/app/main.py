"""FastAPI main application entrypoint for Sovereign-Core."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_v1_router
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    yield
    # Teardown / cleanup tasks


def create_application() -> FastAPI:
    app = FastAPI(
        title="Sovereign-Core Local AI Workbench",
        description="Production-grade local AI orchestrator connecting to Ollama, vector stores, and custom tools.",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Attach API v1 routes
    app.include_router(api_v1_router)

    @app.get("/", tags=["Root"])
    async def root():
        return {
            "name": "Sovereign-Core AI Workbench",
            "version": "0.1.0",
            "status": "online",
            "docs": "/docs",
            "api": "/api/v1",
        }

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={
                "error": "InternalServerError",
                "detail": str(exc),
                "path": request.url.path,
            },
        )

    return app


app = create_application()
