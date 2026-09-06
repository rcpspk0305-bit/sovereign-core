"""FastAPI main application entrypoint for Sovereign-Core."""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app.api.v1.router import api_v1_router
from app.config import settings
from app.core.interfaces.llm import (
    LLMConnectionError,
    LLMError,
    LLMModelNotFoundError,
    LLMResponseError,
    LLMTimeoutError,
    LLMValidationError,
)

logger = logging.getLogger("sovereign.main")


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

    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon():
        return Response(status_code=204)

    # Register LLM domain exception handlers
    @app.exception_handler(LLMConnectionError)
    async def handle_llm_connection_error(request: Request, exc: LLMConnectionError):
        return JSONResponse(
            status_code=503,
            content={
                "error": "LLMConnectionError",
                "detail": exc.message,
                "provider": exc.provider,
                "path": request.url.path,
            },
        )

    @app.exception_handler(LLMTimeoutError)
    async def handle_llm_timeout_error(request: Request, exc: LLMTimeoutError):
        return JSONResponse(
            status_code=504,
            content={
                "error": "LLMTimeoutError",
                "detail": exc.message,
                "timeout_seconds": exc.timeout_seconds,
                "provider": exc.provider,
                "model": exc.model,
                "path": request.url.path,
            },
        )

    @app.exception_handler(LLMModelNotFoundError)
    async def handle_llm_model_not_found(request: Request, exc: LLMModelNotFoundError):
        return JSONResponse(
            status_code=404,
            content={
                "error": "LLMModelNotFoundError",
                "detail": exc.message,
                "model": exc.model,
                "provider": exc.provider,
                "path": request.url.path,
            },
        )

    @app.exception_handler(LLMResponseError)
    async def handle_llm_response_error(request: Request, exc: LLMResponseError):
        return JSONResponse(
            status_code=502,
            content={
                "error": "LLMResponseError",
                "detail": exc.message,
                "status_code": exc.status_code,
                "provider": exc.provider,
                "path": request.url.path,
            },
        )

    @app.exception_handler(LLMValidationError)
    async def handle_llm_validation_error(request: Request, exc: LLMValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": "LLMValidationError",
                "detail": exc.message,
                "path": request.url.path,
            },
        )

    @app.exception_handler(LLMError)
    async def handle_llm_base_error(request: Request, exc: LLMError):
        return JSONResponse(
            status_code=500,
            content={
                "error": "LLMError",
                "detail": exc.message,
                "provider": exc.provider,
                "path": request.url.path,
            },
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled server exception at %s: %s", request.url.path, exc)
        is_production = settings.ENVIRONMENT.lower() == "production"
        detail = "An unexpected error occurred." if is_production else str(exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": "InternalServerError",
                "detail": detail,
                "path": request.url.path,
            },
        )

    return app


app = create_application()
