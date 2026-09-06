"""Health and system diagnostics router."""

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.config import settings
from app.core.llm.service import LLMService, get_llm_service

router = APIRouter(prefix="/health", tags=["Health"])


class HealthStatus(BaseModel):
    status: str
    environment: str
    ollama_connected: bool
    ollama_url: str
    default_model: str
    default_model_available: bool
    available_models: List[str] = Field(default_factory=list)
    latency_ms: Optional[float] = None
    error: Optional[str] = None


@router.get("", response_model=HealthStatus)
async def check_health(
    llm_service: LLMService = Depends(get_llm_service),
) -> HealthStatus:
    """Return backend health status, Ollama connectivity, and model readiness."""
    health_info = await llm_service.check_health()
    return HealthStatus(
        status="healthy" if health_info.is_alive else "degraded",
        environment=settings.ENVIRONMENT,
        ollama_connected=health_info.is_alive,
        ollama_url=settings.OLLAMA_BASE_URL,
        default_model=health_info.default_model,
        default_model_available=health_info.default_model_available,
        available_models=health_info.available_models,
        latency_ms=health_info.latency_ms,
        error=health_info.error,
    )
