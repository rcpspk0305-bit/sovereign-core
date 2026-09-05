"""Master router for API v1."""

from fastapi import APIRouter
from app.api.v1.agents import router as agents_router
from app.api.v1.audit import router as audit_router
from app.api.v1.chat import router as chat_router
from app.api.v1.health import router as health_router
from app.api.v1.models import router as models_router
from app.api.v1.rag import router as rag_router
from app.api.v1.tools import router as tools_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(health_router)
api_v1_router.include_router(models_router)
api_v1_router.include_router(chat_router)
api_v1_router.include_router(rag_router)
api_v1_router.include_router(tools_router)
api_v1_router.include_router(agents_router)
api_v1_router.include_router(audit_router)
