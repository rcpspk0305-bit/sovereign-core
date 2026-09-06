"""Health and system diagnostics router."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.config import settings
from app.core.interfaces.llm import BaseLLMClient
from app.core.llm.ollama import OllamaClient

router = APIRouter(prefix="/health", tags=["Health"])


def get_llm_client() -> BaseLLMClient:
    return OllamaClient()


class HealthStatus(BaseModel):
    status: str
    environment: str
    ollama_connected: bool
    ollama_url: str


@router.get("", response_model=HealthStatus)
async def check_health(
    llm_client: BaseLLMClient = Depends(get_llm_client),
) -> HealthStatus:
    """Return backend health status and Ollama connectivity."""
    ollama_ok = await llm_client.health()
    return HealthStatus(
        status="healthy",
        environment=settings.ENVIRONMENT,
        ollama_connected=ollama_ok,
        ollama_url=settings.OLLAMA_BASE_URL,
    )
